import { prisma } from '@/http/lib/prisma'
import { Request, Response } from 'express'
import { NotFoundError } from '@/http/_errors/not-found-error'

export class GetChannelController {
  public async handle(request: Request, response: Response): Promise<Response> {
    const { slug } = request.params
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

    return response.status(200).json(channel)
  }
}

