import { BadRequestError } from "@/http/_errors/bad-request-error"
import { prisma } from "@/http/lib/prisma"
import { Request, Response } from 'express'

export class RejectInviteController {
  async handle(request: Request, response: Response) {
    const userId = request.user.id
    const { inviteId } = request.params

    const invite = await prisma.invite.findUnique({
      where: {
        id: inviteId
      }
    })

    if (!invite) {
      throw new BadRequestError('Invite not found')
    }

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
    })

    if (!user) {
      throw new BadRequestError('User not found.')
    }

    if (invite.inviteeId !== userId) {
      throw new BadRequestError('This invite belongs to another user.')
    }

    prisma.invite.delete({
      where: {
        id: inviteId,
      },
    })

    return response.status(204).send()
  }
}