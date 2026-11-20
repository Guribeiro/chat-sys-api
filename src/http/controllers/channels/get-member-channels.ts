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
          select: { memberId: true, muted: true, member: { select: userSummarySelect } },
        },
      },
    })

    // Unread = messages from other people after my last read, per channel, in a single query.
    // "addressed" counts the unread ones that mention me or reply to me (they still notify when muted).
    const unreadRows = await prisma.$queryRaw<{ channelId: string; unread: number; addressed: number }[]>`
      SELECT m.channel_id AS "channelId",
             COUNT(msg.id)::int AS unread,
             (COUNT(msg.id) FILTER (
               WHERE parent.author_id = ${userId}
                  OR EXISTS (SELECT 1 FROM mentions mn WHERE mn.message_id = msg.id AND mn.user_id = ${userId})
             ))::int AS addressed
      FROM members m
      JOIN messages msg
        ON msg.channel_id = m.channel_id
       AND msg.author_id <> m.member_id
       AND msg.deleted_at IS NULL
       AND msg.created_at > m.last_read_at
      LEFT JOIN messages parent ON parent.id = msg.parent_id
      WHERE m.member_id = ${userId}
      GROUP BY m.channel_id
    `
    const unreadByChannel = new Map(unreadRows.map((row) => [row.channelId, row]))

    return response.status(200).json(
      channels.map(({ members, ...channel }) => ({
        ...channel,
        unreadCount: unreadByChannel.get(channel.id)?.unread ?? 0,
        /** Unread mentions of me / replies to me: they show even when the channel is muted */
        unreadMentionCount: unreadByChannel.get(channel.id)?.addressed ?? 0,
        muted: members.find((member) => member.memberId === userId)?.muted ?? false,
        // For a DM, the other participant (title/avatar shown in the sidebar)
        peer: channel.type === 'DIRECT' ? members.find((member) => member.memberId !== userId)?.member ?? null : undefined,
      })),
    )
  }
}
