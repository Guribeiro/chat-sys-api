import { ForbiddenError, NotFoundError } from "@/http/_errors"
import { prisma } from "@/http/lib/prisma"
import { getMembership } from "@/http/lib/get-membership"
import { Request, Response } from 'express'
import { getIO, rooms } from '@/socket'

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
      throw new NotFoundError('Convite não encontrado')
    }

    // The author or any channel admin may revoke
    if (invite.authorId !== userId && !isAdmin) {
      throw new ForbiddenError('Você não pode revogar este convite')
    }

    await prisma.invite.delete({
      where: {
        id: invite.id,
      },
    })

    // The invitee's pending list drops it live
    getIO().to(rooms.user(invite.inviteeId)).emit('notification:invite_revoked', { inviteId: invite.id })

    return response.status(204).send()
  }
}
