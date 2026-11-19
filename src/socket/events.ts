// Shared Socket.io event contracts. Keep in sync with web/src/socket/events.ts

export interface SocketMessage {
  id: string
  content: string | null
  authorId: string
  createdAt: Date
  author: { id: string; name: string | null; email: string }
}

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
  'channel:updated': (payload: { channelId: string; slug: string; title: string; active: boolean }) => void
  'channel:deleted': (payload: { channelId: string }) => void
  'channel:member_added': (payload: { channelId: string; userId: string }) => void
  'channel:member_removed': (payload: { channelId: string; userId: string }) => void
  'notification:new_invite': (payload: { invite: SocketInvite }) => void
}

export interface ClientToServerEvents {
  'channel:join': (payload: { slug: string }, ack?: Ack) => void
  'channel:leave': (payload: { slug: string }) => void
}

export interface SocketData {
  userId: string
}

export const rooms = {
  user: (userId: string) => `user:${userId}`,
  channel: (channelId: string) => `channel:${channelId}`,
}
