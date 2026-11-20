import type { Prisma } from '@prisma/client'
import { attachmentSelect, toAttachmentPayload } from './attachment-select'

export const userSummarySelect = { id: true, name: true, email: true, avatarUrl: true } as const

/** Shape of a message read from the database (see toMessagePayload for what clients get). */
export const messageSelect = {
  id: true,
  content: true,
  authorId: true,
  channelId: true,
  createdAt: true,
  updatedAt: true,
  editedAt: true,
  deletedAt: true,
  parentId: true,
  author: { select: userSummarySelect },
  // Quoted preview of the message this one replies to
  parent: {
    select: {
      id: true,
      content: true,
      deletedAt: true,
      authorId: true,
      author: { select: { id: true, name: true } },
      _count: { select: { attachments: true } },
    },
  },
  reactions: {
    orderBy: { createdAt: 'asc' },
    select: { emoji: true, userId: true, user: { select: { name: true } } },
  },
  mentions: {
    select: { userId: true, user: { select: { id: true, name: true } } },
  },
  attachments: {
    orderBy: { createdAt: 'asc' },
    select: attachmentSelect,
  },
} satisfies Prisma.MessageSelect

export type MessageRow = Prisma.MessageGetPayload<{ select: typeof messageSelect }>

/**
 * What clients receive over HTTP and Socket.io: storage keys become public paths and deleted
 * messages keep their place in the timeline, but never their content (nor their quote).
 */
function toParentPayload(parent: MessageRow['parent']) {
  if (!parent) return null
  const { _count, ...rest } = parent
  return {
    ...rest,
    content: rest.deletedAt ? null : rest.content,
    attachmentCount: rest.deletedAt ? 0 : _count.attachments,
  }
}

export function toMessagePayload(message: MessageRow) {
  const parent = toParentPayload(message.parent)

  if (message.deletedAt) {
    return { ...message, content: null, reactions: [], mentions: [], attachments: [], parent }
  }

  return { ...message, parent, attachments: message.attachments.map(toAttachmentPayload) }
}

export type MessagePayload = ReturnType<typeof toMessagePayload>

export const reactionSelect = messageSelect.reactions
