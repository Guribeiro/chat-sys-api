import { Request, Response } from 'express'
import { Prisma } from '@prisma/client'

import { prisma } from '@/http/lib/prisma'
import { extractMentionIds, toPlainPreview } from '@/http/lib/mentions'

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
  content: string
  rank: number
}

// Single-excerpt mode: the fragment mode (MaxFragments >= 1) drops leading words of the excerpt
const HEADLINE_OPTIONS = `StartSel=${START}, StopSel=${STOP}, MaxWords=30, MinWords=10, MaxFragments=0`
const MARKERS = new RegExp(`[${START}${STOP}]`, 'g')

/** Marks a cut excerpt with "…" on the side(s) where the message continues. */
function withEllipsis(snippet: string, full: string) {
  const bare = snippet.replace(MARKERS, '').trim()
  const head = full.startsWith(bare.slice(0, 20)) ? '' : '…'
  const tail = full.endsWith(bare.slice(-20)) ? '' : '…'
  return `${head}${snippet.trim()}${tail}`
}

/** Full-text search (Portuguese stemming) over every channel I belong to. */
export class SearchMessagesController {
  public async handle(request: Request, response: Response) {
    const userId = request.user.id
    const { q, limit } = request.query as unknown as { q: string; limit: number }

    const rows = await prisma.$queryRaw<Row[]>(Prisma.sql`
      SELECT m.id, m.channel_id AS "channelId", c.slug, c.title, c.type, m.created_at AS "createdAt",
             m.author_id AS "authorId", u.name AS "authorName", u.avatar_url AS "authorAvatarUrl",
             m.content,
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

    // Mention tokens become @Name *before* the snippet is cut: ts_headline splits `<@uuid>` into
    // several words and could start a fragment in the middle of one, leaking part of the id.
    const tokenIds = new Set(rows.flatMap((row) => extractMentionIds(row.content)))
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

    const plainContents = rows.map((row) => toPlainPreview(row.content, names, 4000))
    const headlines = plainContents.length
      ? await prisma.$queryRaw<{ snippet: string }[]>(Prisma.sql`
        SELECT ts_headline('portuguese', t.content, websearch_to_tsquery('portuguese', ${q}), ${HEADLINE_OPTIONS}) AS snippet
        FROM unnest(${plainContents}::text[]) WITH ORDINALITY AS t(content, position)
        ORDER BY t.position
      `)
      : []

    return response.status(200).json({
      results: rows.map(({ content: _content, rank: _rank, authorName, authorAvatarUrl, ...row }, index) => ({
        ...row,
        title: row.type === 'DIRECT' ? peerNames.get(row.channelId) ?? 'Mensagem direta' : row.title,
        author: { id: row.authorId, name: authorName, avatarUrl: authorAvatarUrl },
        snippet: withEllipsis(toPlainPreview(headlines[index]?.snippet ?? '', names, 400), plainContents[index]),
      })),
    })
  }
}
