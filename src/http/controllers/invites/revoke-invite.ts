import { ForbiddenError, NotFoundError } from "@/http/_errors"
import { prisma } from "@/http/lib/prisma"
import { getMembership } from "@/http/lib/get-membership"
import { Request, Response } from 'express'

export class RevokeInviteController {
  async handle(request: Request, response: Response) {
    const userId = request.user.id
    const { slug, inviteId } = request.params

    const { channel, isAdmin } = await getMembership(slug, userId)

    const invite = await prisma.invite.findFirst({
      where: {
        id: inviteId,
        channelId: channel.id,
      }
    })

    if (!invite) {
      throw new NotFoundError('Invite not found')
    }

    // The author or any channel admin may revoke
    if (invite.authorId !== userId && !isAdmin) {
      throw new ForbiddenError('You are not allowed to revoke this invite')
    }

    await prisma.invite.delete({
      where: {
        id: invite.id,
      },
    })

    return response.status(204).send()
  }
}
