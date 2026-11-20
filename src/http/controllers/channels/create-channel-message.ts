import { Request, Response } from 'express'
import { prisma } from '@/http/lib/prisma'
import { BadRequestError } from '@/http/_errors'
import { getMembership } from '@/http/lib/get-membership'
import { ensureActiveChannel } from '@/http/lib/ensure-group-channel'
import { messageSelect, toMessagePayload } from '@/http/lib/message-select'
import { resolveChannelMentions } from '@/http/lib/mentions'
import { messagePreview, notifyActivity } from '@/http/lib/notify-activity'

import { getIO, rooms } from '@/socket'

export class CreateChannelMessageController {
  public async handle(request: Request, response: Response) {
    const userId = request.user.id
    const { slug } = request.params
    const { content, replyToId, attachmentIds = [] } = request.body as {
      content?: string
      replyToId?: string
      attachmentIds?: string[]
    }

    const { channel } = await getMembership(slug, userId)
    ensureActiveChannel(channel)

    let parent: { id: string; authorId: string } | null = null
    if (replyToId) {
      parent = await prisma.message.findFirst({
        where: { id: replyToId, channelId: channel.id },
        select: { id: true, authorId: true },
      })
      if (!parent) {
        throw new BadRequestError('A mensagem que você está respondendo não existe neste canal')
      }
    }

    if (attachmentIds.length) {
      // Only my own pending uploads of this very channel can be attached
      const usable = await prisma.attachment.count({
        where: { id: { in: attachmentIds }, uploaderId: userId, channelId: channel.id, messageId: null },
      })
      if (usable !== attachmentIds.length) {
        throw new BadRequestError('Alguns anexos são inválidos ou já foram enviados')
      }
    }

    const text = content?.trim() || null
    const mentionedIds = text ? await resolveChannelMentions(channel.id, text) : []

    const saved = await prisma.message.create({
      data: {
        content: text,
        authorId: userId,
        channelId: channel.id,
        parentId: replyToId ?? null,
        mentions: mentionedIds.length
          ? { createMany: { data: mentionedIds.map((id) => ({ userId: id })) } }
          : undefined,
        attachments: attachmentIds.length ? { connect: attachmentIds.map((id) => ({ id })) } : undefined,
      },
      select: messageSelect,
    })
    const message = toMessagePayload(saved)

    // The sender has obviously read everything up to their own message
    await prisma.member.update({
      where: { channelId_memberId: { channelId: channel.id, memberId: userId } },
      data: { lastReadAt: message.createdAt },
    })

    const io = getIO()
    io.to(rooms.channel(channel.id)).emit('channel:message', { channelId: channel.id, message })

    // Lightweight signal to every member (even those without the channel open) for unread badges
    const members = await prisma.member.findMany({
      where: { channelId: channel.id },
      select: { memberId: true },
    })
    io.to(members.map(({ memberId }) => rooms.user(memberId))).emit('channel:activity', {
      channelId: channel.id,
      messageId: message.id,
      authorId: userId,
      authorName: message.author.name,
      preview: messagePreview(message),
    })

    notifyActivity(channel, message, { mentionedIds, replyToAuthorId: parent?.authorId })

    return response.status(200).json(message)
  }
}
