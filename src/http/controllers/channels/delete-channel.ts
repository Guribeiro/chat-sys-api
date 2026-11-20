import { ensureGroupChannel } from '@/http/lib/ensure-group-channel'
import { Request, Response } from 'express'
import { prisma } from '@/http/lib/prisma'
import { ForbiddenError } from '@/http/_errors'
import { getMembership } from '@/http/lib/get-membership'
import { rooms } from '@/socket'
import { getPublisher } from '@/socket/publisher'
import { deleteQuietly } from '@/lib/storage'

export class DeleteChannelController {
  public async handle(request: Request, response: Response) {
    const { slug } = request.params
    const { channel, isOwner } = await getMembership(slug, request.user.id)
    ensureGroupChannel(channel)

    // Deleting is destructive: only the owner may do it
    if (!isOwner) {
      throw new ForbiddenError('Somente o dono do canal pode excluí-lo')
    }

    // Rows cascade with the channel, the files on disk do not
    const files = await prisma.attachment.findMany({
      where: { channelId: channel.id },
      select: { storageKey: true, thumbnailKey: true },
    })

    await prisma.channel.delete({
      where: {
        id: channel.id,
      }
    })

    await deleteQuietly(files.flatMap(({ storageKey, thumbnailKey }) => [storageKey, thumbnailKey]))

    const io = getPublisher()
    io.to(rooms.channel(channel.id)).emit('channel:deleted', { channelId: channel.id })
    io.socketsLeave(rooms.channel(channel.id))

    return response.status(204).send()
  }
}
