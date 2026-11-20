import { Request, Response } from 'express'
import { prisma } from '@/http/lib/prisma'
import { getMembership } from '@/http/lib/get-membership'
import { messageSelect, toMessagePayload } from '@/http/lib/message-select'

export class GetChannelMessagesController {
  public async handle(request: Request, response: Response) {
    const { slug } = request.params
    const { cursor, limit } = request.query as unknown as { cursor?: string; limit: number }

    const { channel } = await getMembership(slug, request.user.id)

    // Newest first, so the cursor walks back in time; one extra row tells us if there is more
    const rows = await prisma.message.findMany({
      where: { channelId: channel.id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: messageSelect,
    })

    const hasMore = rows.length > limit
    const page = hasMore ? rows.slice(0, limit) : rows

    return response.status(200).json({
      // Chronological order inside the page, ready to render
      messages: page.reverse().map(toMessagePayload),
      nextCursor: hasMore ? page[0].id : null,
    })
  }
}
