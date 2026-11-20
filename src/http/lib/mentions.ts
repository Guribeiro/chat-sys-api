import { prisma } from '@/http/lib/prisma'

/**
 * Mentions are stored inside the content as Slack-style tokens: `<@user-uuid>`.
 * Clients render them with the user's current name, so renaming never breaks old messages.
 */
const MENTION_TOKEN = /<@([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})>/gi

export function extractMentionIds(content: string): string[] {
  return Array.from(new Set(Array.from(content.matchAll(MENTION_TOKEN), (match) => match[1].toLowerCase())))
}

/** Only members of the channel can be mentioned; anything else is ignored. */
export async function resolveChannelMentions(channelId: string, content: string): Promise<string[]> {
  const ids = extractMentionIds(content)
  if (!ids.length) return []

  const members = await prisma.member.findMany({
    where: { channelId, memberId: { in: ids } },
    select: { memberId: true },
  })

  return members.map(({ memberId }) => memberId)
}

/** Plain-text version of a message (for notifications): tokens become @Name, trimmed. */
export function toPlainPreview(content: string, names: Map<string, string | null>, max = 120) {
  const text = content
    .replace(MENTION_TOKEN, (_token, id: string) => `@${names.get(id.toLowerCase()) ?? 'alguém'}`)
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}
