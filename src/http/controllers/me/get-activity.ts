import { Request, Response } from 'express'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/http/lib/prisma'
import { messageSelect, toMessagePayload } from '@/http/lib/message-select'

/** Messages addressed to the user (mentions and replies to them) in channels they still belong to. */
export function activityWhere(userId: string): Prisma.MessageWhereInput {
  return {
    deletedAt: null,
    authorId: { not: userId },
    channel: { members: { some: { memberId: userId } } },
    OR: [
      { mentions: { some: { userId } } },
      { parent: { authorId: userId } },
    ],
  }
}

export class GetActivityController {
  public async handle(request: Request, response: Response) {
    const userId = request.user.id
    const { cursor, limit } = request.query as unknown as { cursor?: string; limit: number }

    const where = activityWhere(userId)

    const [rows, user] = await Promise.all([
      prisma.message.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: { ...messageSelect, channel: { select: { id: true, slug: true, title: true, type: true } } },
      }),
      prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { activitySeenAt: true } }),
    ])

    const unreadCount = await prisma.message.count({
      where: { ...where, ...(user.activitySeenAt ? { createdAt: { gt: user.activitySeenAt } } : {}) },
    })

    const hasMore = rows.length > limit
    const page = hasMore ? rows.slice(0, limit) : rows

    return response.status(200).json({
      items: page.map(({ channel, ...row }) => {
        const message = toMessagePayload(row)
        const mentioned = message.mentions.some((mention) => mention.userId === userId)
        return {
          reason: mentioned ? ('mention' as const) : ('reply' as const),
          channel,
          message,
          unread: !user.activitySeenAt || message.createdAt > user.activitySeenAt,
        }
      }),
      nextCursor: hasMore ? page[page.length - 1].id : null,
      unreadCount,
      seenAt: user.activitySeenAt,
    })
  }
}

export class MarkActivitySeenController {
  public async handle(request: Request, response: Response) {
    await prisma.user.update({ where: { id: request.user.id }, data: { activitySeenAt: new Date() } })
    return response.status(204).send()
  }
}
