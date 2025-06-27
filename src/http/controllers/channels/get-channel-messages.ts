import { Request, Response } from 'express'
import { prisma } from '@/http/lib/prisma'

export class GetChannelMessagesController {
  public async handle(request: Request, response: Response) {
    const { slug } = request.params
    const messages = await prisma.message.findMany({
      where: {
        channel: {
          slug
        },
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        }
      }
    })

    return response.status(200).json({ messages, nextPage: null, previousPage: null })
  }
}