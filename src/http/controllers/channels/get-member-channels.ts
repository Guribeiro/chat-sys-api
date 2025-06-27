import { Request, Response } from 'express'
import { prisma } from '@/http/lib/prisma'

export class GetMemberChannelsController {
  public async handle(request: Request, response: Response) {
    const userId = request.user.id
    const channels = await prisma.channel.findMany({
      where: {
        active: true,
        AND: {
          memberships: {
            some: {
              memberId: userId,
            }
          }
        }
      }
    })

    return response.status(200).json(channels)
  }
}