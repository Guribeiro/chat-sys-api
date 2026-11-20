import { Request, Response } from 'express'
import { prisma } from '@/http/lib/prisma'
import { ForbiddenError, NotFoundError } from '@/http/_errors'
import { getMembership } from '@/http/lib/get-membership'

import { rooms } from '@/socket'
import { getPublisher } from '@/socket/publisher'
import { deleteQuietly } from '@/lib/storage'

export class DeleteChannelMessageController {
  public async handle(request: Request, response: Response) {
    const userId = request.user.id
    const { slug, messageId } = request.params

    const { channel, isAdmin } = await getMembership(slug, userId)

    const existing = await prisma.message.findFirst({
      where: { id: messageId, channelId: channel.id },
      select: { authorId: true, deletedAt: true },
    })

    if (!existing) {
      throw new NotFoundError('Mensagem não encontrada')
    }

    // Authors delete their own messages; channel admins can moderate any message
    if (existing.authorId !== userId && !isAdmin) {
      throw new ForbiddenError('Você não pode excluir esta mensagem')
    }

    if (!existing.deletedAt) {
      const files = await prisma.attachment.findMany({
        where: { messageId },
        select: { storageKey: true, thumbnailKey: true },
      })

      // Soft delete: the row stays (keeps the timeline and pagination stable), the content goes
      const [{ deletedAt }] = await prisma.$transaction([
        prisma.message.update({
          where: { id: messageId },
          data: { content: null, deletedAt: new Date() },
          select: { deletedAt: true },
        }),
        prisma.reaction.deleteMany({ where: { messageId } }),
        prisma.mention.deleteMany({ where: { messageId } }),
        prisma.attachment.deleteMany({ where: { messageId } }),
      ])
      await deleteQuietly(files.flatMap(({ storageKey, thumbnailKey }) => [storageKey, thumbnailKey]))

      getPublisher().to(rooms.channel(channel.id)).emit('channel:message_deleted', {
        channelId: channel.id,
        messageId,
        deletedAt: deletedAt!,
      })
    }

    return response.status(204).send()
  }
}
