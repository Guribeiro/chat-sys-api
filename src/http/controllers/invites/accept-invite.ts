import { ForbiddenError, NotFoundError } from "@/http/_errors"
import { prisma } from "@/http/lib/prisma"
import { Request, Response } from 'express'
import { rooms } from '@/socket'
import { getPublisher } from '@/socket/publisher'

export class AcceptInviteController {
  async handle(request: Request, response: Response) {
    const userId = request.user.id
    const { inviteId } = request.params

    const invite = await prisma.invite.findUnique({
      where: {
        id: inviteId
      }
    })

    if (!invite) {
      throw new NotFoundError('Convite não encontrado')
    }

    if (invite.inviteeId !== userId) {
      throw new ForbiddenError('Este convite pertence a outra pessoa.')
    }

    await prisma.$transaction([
      // upsert: accepting is idempotent even if the user somehow already is a member
      prisma.member.upsert({
        where: { channelId_memberId: { channelId: invite.channelId, memberId: invite.inviteeId } },
        create: {
          memberId: invite.inviteeId,
          role: invite.role,
          channelId: invite.channelId,
        },
        update: {},
      }),
      prisma.invite.delete({
        where: {
          id: inviteId,
        },
      }),
    ])

    getPublisher()
      .to(rooms.channel(invite.channelId))
      .emit('channel:member_added', { channelId: invite.channelId, userId: invite.inviteeId })

    return response.status(204).send()
  }
}
