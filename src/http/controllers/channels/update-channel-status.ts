import { prisma } from '@/http/lib/prisma'
import { Request, Response } from 'express'

import { NotFoundError } from '@/http/_errors/not-found-error'

export class UpdateChannelStatus {
  public async handle(request: Request, response: Response): Promise<Response> {
    const { slug } = request.params
    const { status } = request.body
    const userId = request.user.id

    const channel = await prisma.channel.findUnique({
      where: {
        ownerId: userId,
        slug,
      }
    })

    if (!channel) {
      throw new NotFoundError('Channel not found')
    }

    await prisma.channel.update({
      where: {
        ownerId: userId,
        slug,
      },
      data: {
        active: status === 'ATIVO',
      }
    })

    Object.assign(channel, { active: status === 'ATIVO' })

    return response.status(200).json(channel)
  }
}

