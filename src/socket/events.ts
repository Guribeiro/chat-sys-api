// Shared Socket.io event contracts. Keep in sync with web/src/socket/events.ts

import type { MessagePayload } from '@/http/lib/message-select'

export type SocketMessage = MessagePayload

export interface SocketInvite {
  id: string
  role: 'ADMIN' | 'MEMBER'
  authorId: string
  inviteeId: string
  channelId: string
  createdAt: Date
  author: { id: string; name: string | null; email: string }
  channel: { id: string; title: string; description: string | null }
}

export type Ack = (response: { ok: true; channelId: string } | { ok: false; error: string }) => void

export interface ServerToClientEvents {
  'presence:snapshot': (userIds: string[]) => void
  'presence:update': (userIds: string[]) => void
  'channel:message': (payload: { channelId: string; message: SocketMessage }) => void
  'channel:message_updated': (payload: { channelId: string; message: SocketMessage }) => void
  'channel:message_deleted': (payload: { channelId: string; messageId: string; deletedAt: Date }) => void
  /** Sent to each member's personal room on every new message, used for unread badges */
  'channel:activity': (payload: {
    channelId: string
    messageId: string
    authorId: string
    authorName: string | null
    /** Plain-text preview, used for desktop notifications of DMs */
    preview: string
  }) => void
  'channel:typing': (payload: { channelId: string; userId: string; name: string | null }) => void
  'channel:message_reactions': (payload: {
    channelId: string
    messageId: string
    reactions: { emoji: string; userId: string; user: { name: string | null } }[]
  }) => void
  'channel:updated': (payload: { channelId: string; slug: string; title: string; active: boolean }) => void
  'channel:deleted': (payload: { channelId: string }) => void
  'channel:member_added': (payload: { channelId: string; userId: string }) => void
  'channel:member_removed': (payload: { channelId: string; userId: string }) => void
  'channel:member_updated': (payload: { channelId: string; userId: string; role: 'ADMIN' | 'MEMBER' }) => void
  'channel:owner_changed': (payload: { channelId: string; previousOwnerId: string; ownerId: string }) => void
  'notification:invite_revoked': (payload: { inviteId: string }) => void
  'notification:new_invite': (payload: { invite: SocketInvite }) => void
  /** Something addressed to me: a mention, or a reply to one of my messages */
  'notification:activity': (payload: {
    reason: 'mention' | 'reply'
    channelId: string
    channelSlug: string
    channelTitle: string
    channelType: 'GROUP' | 'DIRECT'
    messageId: string
    author: { id: string; name: string | null; avatarUrl: string | null }
    preview: string
  }) => void
}

export interface ClientToServerEvents {
  'channel:join': (payload: { slug: string }, ack?: Ack) => void
  'channel:leave': (payload: { slug: string }) => void
  'channel:typing': (payload: { channelId: string }) => void
}

export interface SocketData {
  userId: string
  /** Display name, loaded lazily the first time it is needed (typing indicator) */
  name?: string | null
}

export const rooms = {
  user: (userId: string) => `user:${userId}`,
  channel: (channelId: string) => `channel:${channelId}`,
}
