import { prisma } from "@/http/lib/prisma"
import { Request, Response } from 'express'

export class GetPendingInvitesController {
  async handle(request: Request, response: Response) {
    const userId = request.user.id

    const invites = await prisma.invite.findMany({
      where: {
        inviteeId: userId,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        channel: {
          select: {
            id: true,
            title: true,
            description: true
          },
        }
      },
    })

    return response.status(200).json(invites)
  }
}