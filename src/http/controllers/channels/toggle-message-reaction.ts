import { Request, Response } from 'express'
import { prisma } from '@/http/lib/prisma'
import { BadRequestError, NotFoundError } from '@/http/_errors'
import { getMembership } from '@/http/lib/get-membership'
import { reactionSelect } from '@/http/lib/message-select'

import { getIO, rooms } from '@/socket'

/** Distinct emojis a single message may collect */
const MAX_DISTINCT_EMOJIS = 20

export class ToggleMessageReactionController {
  public async handle(request: Request, response: Response) {
    const userId = request.user.id
    const { slug, messageId } = request.params
    const { emoji } = request.body as { emoji: string }

    const { channel } = await getMembership(slug, userId)

    const message = await prisma.message.findFirst({
      where: { id: messageId, channelId: channel.id },
      select: { id: true, deletedAt: true },
    })

    if (!message) {
      throw new NotFoundError('Message not found')
    }

    if (message.deletedAt) {
      throw new BadRequestError('You can not react to a deleted message')
    }

    const key = { messageId_userId_emoji: { messageId, userId, emoji } }
    const existing = await prisma.reaction.findUnique({ where: key, select: { id: true } })

    if (existing) {
      await prisma.reaction.delete({ where: { id: existing.id } })
    } else {
      const distinct = await prisma.reaction.findMany({
        where: { messageId },
        distinct: ['emoji'],
        select: { emoji: true },
      })
      if (distinct.length >= MAX_DISTINCT_EMOJIS && !distinct.some((reaction) => reaction.emoji === emoji)) {
        throw new BadRequestError('This message already has too many different reactions')
      }
      // upsert guards against a double click racing two creates
      await prisma.reaction.upsert({ where: key, create: { messageId, userId, emoji }, update: {} })
    }

    const reactions = await prisma.reaction.findMany({
      where: { messageId },
      orderBy: reactionSelect.orderBy,
      select: reactionSelect.select,
    })

    getIO().to(rooms.channel(channel.id)).emit('channel:message_reactions', {
      channelId: channel.id,
      messageId,
      reactions,
    })

    return response.status(200).json({ messageId, reactions })
  }
}
