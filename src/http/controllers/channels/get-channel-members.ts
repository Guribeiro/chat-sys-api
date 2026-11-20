import { userSummarySelect } from '@/http/lib/message-select'
import { Request, Response } from 'express'
import { prisma } from '@/http/lib/prisma'
import { getMembership } from '@/http/lib/get-membership'

export class GetChannelMembersController {
  public async handle(request: Request, response: Response) {
    const { slug } = request.params
    const { channel } = await getMembership(slug, request.user.id)

    const members = await prisma.member.findMany({
      where: { channelId: channel.id },
      orderBy: { createdAt: 'asc' },
      include: {
        member: { select: userSummarySelect }
      }
    })

    return response.status(200).json(
      members.map((member) => ({ ...member, isOwner: member.memberId === channel.ownerId })),
    )
  }
}
