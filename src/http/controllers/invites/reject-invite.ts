import { ForbiddenError, NotFoundError } from "@/http/_errors"
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
      throw new NotFoundError('Invite not found')
    }

    if (invite.inviteeId !== userId) {
      throw new ForbiddenError('This invite belongs to another user.')
    }

    await prisma.invite.delete({
      where: {
        id: inviteId,
      },
    })

    return response.status(204).send()
  }
}
