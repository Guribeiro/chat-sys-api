import type { Channel } from '@prisma/client'

import { rooms } from '@/socket'
import { getPublisher } from '@/socket/publisher'
import type { MessagePayload } from './message-select'
import { toPlainPreview } from './mentions'

export type ActivityReason = 'mention' | 'reply'

/** Plain-text preview of a message, with mention tokens rendered as @Name. */
export function messagePreview(message: MessagePayload) {
  if (!message.content) return message.attachments.length ? '📎 Anexo' : ''
  const names = new Map(message.mentions.map(({ user }) => [user.id, user.name]))
  return toPlainPreview(message.content, names)
}

/**
 * Notifies, on their personal room, everyone the message is addressed to: mentioned users and
 * the author of the message it replies to. The author never notifies themself and nobody is
 * notified twice (a mention wins over a reply).
 */
export function notifyActivity(
  channel: Channel,
  message: MessagePayload,
  { mentionedIds = [], replyToAuthorId = null }: { mentionedIds?: string[]; replyToAuthorId?: string | null },
) {
  const targets = new Map<string, ActivityReason>()
  if (replyToAuthorId) targets.set(replyToAuthorId, 'reply')
  for (const id of mentionedIds) targets.set(id, 'mention')
  targets.delete(message.authorId)
  if (!targets.size) return

  const io = getPublisher()
  const base = {
    channelId: channel.id,
    channelSlug: channel.slug,
    channelTitle: channel.title,
    channelType: channel.type,
    messageId: message.id,
    author: { id: message.author.id, name: message.author.name, avatarUrl: message.author.avatarUrl },
    preview: messagePreview(message),
  }

  for (const reason of ['mention', 'reply'] as const) {
    const userIds = [...targets].filter(([, value]) => value === reason).map(([id]) => rooms.user(id))
    if (userIds.length) io.to(userIds).emit('notification:activity', { ...base, reason })
  }
}
