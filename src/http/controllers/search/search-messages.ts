import { Request, Response } from 'express'
import { Prisma } from '@prisma/client'

import { prisma } from '@/http/lib/prisma'
import { toPlainPreview } from '@/http/lib/mentions'

// Control characters as highlight markers: they can never appear in user text after
// rendering, so the client splits on them instead of injecting HTML.
const START = '\u0001'
const STOP = '\u0002'

type Row = {
  id: string
  channelId: string
  slug: string
  title: string
  type: 'GROUP' | 'DIRECT'
  createdAt: Date
  authorId: string
  authorName: string | null
  authorAvatarUrl: string | null
  snippet: string
  rank: number
}

/** Full-text search (Portuguese stemming) over every channel I belong to. */
export class SearchMessagesController {
  public async handle(request: Request, response: Response) {
    const userId = request.user.id
    const { q, limit } = request.query as unknown as { q: string; limit: number }

    const rows = await prisma.$queryRaw<Row[]>(Prisma.sql`
      SELECT m.id, m.channel_id AS "channelId", c.slug, c.title, c.type, m.created_at AS "createdAt",
             m.author_id AS "authorId", u.name AS "authorName", u.avatar_url AS "authorAvatarUrl",
             ts_headline('portuguese', m.content, query,
               ${`StartSel=${START}, StopSel=${STOP}, MaxWords=30, MinWords=10, MaxFragments=1`}) AS snippet,
             ts_rank(to_tsvector('portuguese', coalesce(m.content, '')), query) AS rank
      FROM messages m
      JOIN channels c ON c.id = m.channel_id
      JOIN members mb ON mb.channel_id = c.id AND mb.member_id = ${userId}
      JOIN users u ON u.id = m.author_id,
           websearch_to_tsquery('portuguese', ${q}) AS query
      WHERE m.deleted_at IS NULL
        AND to_tsvector('portuguese', coalesce(m.content, '')) @@ query
      ORDER BY rank DESC, m.created_at DESC
      LIMIT ${limit}
    `)

    // Mention tokens inside snippets become @Name; DM titles become the other person's name
    const tokenIds = new Set<string>()
    rows.forEach((row) => row.snippet.match(/<@([0-9a-f-]{36})>/gi)?.forEach((token) => tokenIds.add(token.slice(2, -1).toLowerCase())))
    const directIds = rows.filter((row) => row.type === 'DIRECT').map((row) => row.channelId)

    const [mentioned, peers] = await Promise.all([
      tokenIds.size
        ? prisma.user.findMany({ where: { id: { in: [...tokenIds] } }, select: { id: true, name: true } })
        : [],
      directIds.length
        ? prisma.member.findMany({
          where: { channelId: { in: directIds }, memberId: { not: userId } },
          select: { channelId: true, member: { select: { name: true } } },
        })
        : [],
    ])
    const names = new Map(mentioned.map((user) => [user.id, user.name]))
    const peerNames = new Map(peers.map((peer) => [peer.channelId, peer.member.name]))

    return response.status(200).json({
      results: rows.map(({ snippet, rank: _rank, authorName, authorAvatarUrl, ...row }) => ({
        ...row,
        title: row.type === 'DIRECT' ? peerNames.get(row.channelId) ?? 'Mensagem direta' : row.title,
        author: { id: row.authorId, name: authorName, avatarUrl: authorAvatarUrl },
        snippet: toPlainPreview(snippet, names, 400),
      })),
    })
  }
}
