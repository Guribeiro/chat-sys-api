import { ensureGroupChannel } from '@/http/lib/ensure-group-channel'
import { prisma } from '@/http/lib/prisma'
import { Request, Response } from 'express'

import { BadRequestError } from '@/http/_errors'
import { getAdminMembership } from '@/http/lib/get-membership'
import { getIO, rooms } from '@/socket'
import { createSlug } from '@/utils/create-slug'

export class UpdateChannelController {
  public async handle(request: Request, response: Response): Promise<Response> {
    const { slug } = request.params
    const { title, description } = request.body as { title: string; description?: string | null }

    const { channel } = await getAdminMembership(slug, request.user.id)
    ensureGroupChannel(channel)

    const newSlug = createSlug(title)

    if (newSlug !== channel.slug) {
      const slugTaken = await prisma.channel.findUnique({ where: { slug: newSlug }, select: { id: true } })
      if (slugTaken) {
        throw new BadRequestError('Já existe um canal com este título')
      }
    }

    const updated = await prisma.channel.update({
      where: { id: channel.id },
      data: {
        title,
        description,
        slug: newSlug
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
