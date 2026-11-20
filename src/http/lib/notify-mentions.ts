import type { Channel } from '@prisma/client'

import { getIO, rooms } from '@/socket'
import type { MessagePayload } from './message-select'
import { toPlainPreview } from './mentions'

/** Notifies (on their personal room) every mentioned user except the author. */
export function notifyMentions(channel: Channel, message: MessagePayload, userIds: string[]) {
  const targets = userIds.filter((id) => id !== message.authorId)
  if (!targets.length || !message.content) return

  const names = new Map(message.mentions.map(({ user }) => [user.id, user.name]))

  getIO()
    .to(targets.map((id) => rooms.user(id)))
    .emit('notification:mention', {
      channelId: channel.id,
      channelSlug: channel.slug,
      channelTitle: channel.title,
      messageId: message.id,
      author: { id: message.author.id, name: message.author.name },
      preview: toPlainPreview(message.content, names),
    })
}
