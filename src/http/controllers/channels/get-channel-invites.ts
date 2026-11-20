import { ensureGroupChannel } from '@/http/lib/ensure-group-channel'
import { Request, Response } from 'express'
import { prisma } from '@/http/lib/prisma'
import { getAdminMembership } from '@/http/lib/get-membership'
import { userSummarySelect } from '@/http/lib/message-select'

/** Pending invites of the channel (an accepted or rejected invite is deleted). */
export class GetChannelInvitesController {
  public async handle(request: Request, response: Response) {
    const { slug } = request.params
    const { channel } = await getAdminMembership(slug, request.user.id)
    ensureGroupChannel(channel)

    const invites = await prisma.invite.findMany({
      where: { channelId: channel.id },
      orderBy: { createdAt: 'desc' },
      include: {
        author: { select: userSummarySelect },
        invitee: { select: userSummarySelect },
      }
    })

    return response.status(200).json(invites)
  }
}
