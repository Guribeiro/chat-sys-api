import { Request, Response } from 'express'
import { prisma } from '@/http/lib/prisma'

export class GetChannelMembers {
  public async handle(request: Request, response: Response) {
    const { slug } = request.params
    const members = await prisma.membership.findMany({
      where: {
        channel: {
          slug
        },
      },
      include: {
        member: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        }
      }
    })

    return response.status(200).json(members)
  }
}