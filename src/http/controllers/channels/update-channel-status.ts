import { ensureGroupChannel } from '@/http/lib/ensure-group-channel'
import { prisma } from '@/http/lib/prisma'
import { Request, Response } from 'express'

import { getAdminMembership } from '@/http/lib/get-membership'
import { getIO, rooms } from '@/socket'

export class UpdateChannelStatus {
  public async handle(request: Request, response: Response): Promise<Response> {
    const { slug } = request.params
    const { status } = request.body as { status: 'ATIVO' | 'INATIVO' }

    const { channel } = await getAdminMembership(slug, request.user.id)
    ensureGroupChannel(channel)

    const updated = await prisma.channel.update({
      where: { id: channel.id },
      data: {
        active: status === 'ATIVO',
      }
    })

    getIO().to(rooms.channel(updated.id)).emit('channel:updated', {
      channelId: updated.id,
      slug: updated.slug,
      title: updated.title,
      active: updated.active,
    })

    return response.status(200).json(updated)
  }
}
