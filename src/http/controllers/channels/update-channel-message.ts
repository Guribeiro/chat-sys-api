import { Request, Response } from 'express'
import { prisma } from '@/http/lib/prisma'
import { BadRequestError, ForbiddenError, NotFoundError } from '@/http/_errors'
import { getMembership } from '@/http/lib/get-membership'
import { messageSelect, toMessagePayload } from '@/http/lib/message-select'
import { resolveChannelMentions } from '@/http/lib/mentions'
import { notifyActivity } from '@/http/lib/notify-activity'

import { rooms } from '@/socket'
import { getPublisher } from '@/socket/publisher'

export class UpdateChannelMessageController {
  public async handle(request: Request, response: Response) {
    const userId = request.user.id
    const { slug, messageId } = request.params
    const { content } = request.body as { content: string }

    const { channel } = await getMembership(slug, userId)

    const existing = await prisma.message.findFirst({
      where: { id: messageId, channelId: channel.id },
      select: { authorId: true, deletedAt: true, mentions: { select: { userId: true } } },
    })

    if (!existing) {
      throw new NotFoundError('Mensagem não encontrada')
    }

    if (existing.authorId !== userId) {
      throw new ForbiddenError('Você só pode editar as suas mensagens')
    }

    if (existing.deletedAt) {
      throw new BadRequestError('Uma mensagem excluída não pode ser editada')
    }

    const mentionedIds = await resolveChannelMentions(channel.id, content)
    const previouslyMentioned = new Set(existing.mentions.map(({ userId }) => userId))

    const [, saved] = await prisma.$transaction([
      prisma.mention.deleteMany({ where: { messageId } }),
      prisma.message.update({
        where: { id: messageId },
        data: {
          content,
          editedAt: new Date(),
          mentions: mentionedIds.length
            ? { createMany: { data: mentionedIds.map((id) => ({ userId: id })) } }
            : undefined,
        },
        select: messageSelect,
      }),
    ])
    const message = toMessagePayload(saved)

    getPublisher().to(rooms.channel(channel.id)).emit('channel:message_updated', { channelId: channel.id, message })

    // Only people who were not mentioned before get a new notification
    notifyActivity(channel, message, { mentionedIds: mentionedIds.filter((id) => !previouslyMentioned.has(id)) })

    return response.status(200).json(message)
  }
}
