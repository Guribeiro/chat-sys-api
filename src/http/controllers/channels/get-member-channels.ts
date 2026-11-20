import { Request, Response } from 'express'
import type { Prisma, Role } from '@prisma/client'
import { prisma } from '@/http/lib/prisma'
import { userSummarySelect } from '@/http/lib/message-select'

export class GetMemberChannelsController {
  public async handle(request: Request, response: Response) {
    const userId = request.user.id

    const { status, role } = request.query as unknown as {
      status?: 'active' | 'deactive'
      role?: Role
    }

    const where: Prisma.ChannelWhereInput = {
      members: { some: { memberId: userId, ...(role ? { role } : {}) } },
      ...(status ? { active: status === 'active' } : {}),
      // Admin screens filter by role: DMs have no admin features
      ...(role ? { type: 'GROUP' as const } : {}),
    }

    const channels = await prisma.channel.findMany({
      where,
      orderBy: { title: 'asc' },
      include: {
        _count: {
          select: {
            members: true,
          },
        },
        members: {
          select: { memberId: true, lastReadAt: true, member: { select: userSummarySelect } },
        },
      },
    })

    // Unread = messages from other people after my last read, per channel
    const unreadCounts = await Promise.all(
      channels.map(({ id, members }) =>
        prisma.message.count({
          where: {
            channelId: id,
            authorId: { not: userId },
            deletedAt: null,
            createdAt: { gt: members.find((member) => member.memberId === userId)?.lastReadAt ?? new Date(0) },
          },
        }),
      ),
    )

    return response.status(200).json(
      channels.map(({ members, ...channel }, index) => ({
        ...channel,
        unreadCount: unreadCounts[index],
        // For a DM, the other participant (title/avatar shown in the sidebar)
        peer: channel.type === 'DIRECT' ? members.find((member) => member.memberId !== userId)?.member ?? null : undefined,
      })),
    )
  }
}
