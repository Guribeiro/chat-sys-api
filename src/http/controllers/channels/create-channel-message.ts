import { Request, Response } from 'express'
import { prisma } from '@/http/lib/prisma'
import { BadRequestError } from '@/http/_errors/bad-request-error'

import { io } from '@/server'

export class CreateChannelMessage {
  public async handle(request: Request, response: Response) {
    const userId = request.user.id
    const { slug } = request.params
    const { content } = request.body

    const channelFromSlug = await prisma.channel.findUnique({
      where: {
        slug
      }
    })

    if (!channelFromSlug) {
      throw new BadRequestError('Channel not found')
    }

    const message = await prisma.message.create({
      data: {
        content,
        authorId: userId,
        channelId: channelFromSlug.id,
      },
      select: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        },
        authorId: true,
        content: true,
        createdAt: true,
        id: true,
      }
    })

    io.to(slug).emit('channel:send_message', message)

    return response.status(200).json(message)
  }
}