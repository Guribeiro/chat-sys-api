import { prisma } from '@/http/lib/prisma'
import { Request, Response } from 'express'

import { NotFoundError } from '@/http/_errors/not-found-error'
import { createSlug } from '@/utils/create-slug'

export class UpdateChannelController {
  public async handle(request: Request, response: Response): Promise<Response> {
    const { slug } = request.params
    const { title, description } = request.body
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

    const newSlug = createSlug(title)

    await prisma.channel.update({
      where: {
        ownerId: userId,
        slug,
      },
      data: {
        title,
        description,
        slug: newSlug
      }
    })

    Object.assign(channel, { title, description, slug: newSlug })

    return response.status(200).json(channel)
  }
}

