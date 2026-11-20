import { Emitter } from '@socket.io/redis-emitter'

import { env } from '@/env'
import { getRedis, redisEnabled } from '@/lib/redis'
import { getIO, rooms } from './index'
import type { ServerSideEvents, ServerToClientEvents } from './events'

/**
 * How the HTTP side talks to connected clients, whatever the realtime mode:
 * - embedded: the local Socket.io server (with the Redis adapter, emits still reach other instances);
 * - standalone: a Redis emitter. The API holds no connections; it publishes and the realtime
 *   instances deliver. Emits and room operations (socketsJoin/socketsLeave) work the same way.
 */
type RoomEmitter = {
  emit<E extends keyof ServerToClientEvents>(event: E, ...args: Parameters<ServerToClientEvents[E]>): unknown
  to(room: string | string[]): RoomEmitter
  socketsLeave(room: string | string[]): void
}

export type Publisher = {
  to(room: string | string[]): RoomEmitter
  in(room: string | string[]): RoomEmitter
  socketsLeave(room: string | string[]): void
}

let emitter: Emitter<ServerToClientEvents> | null = null

/** Standalone mode only: connects the Redis emitter. Call once on boot. */
export async function initPublisher() {
  const { pub } = await getRedis()
  emitter = new Emitter<ServerToClientEvents>(pub)
}

export function getPublisher(): Publisher {
  if (env.REALTIME_MODE === 'standalone') {
    if (!emitter) throw new Error('Publisher not initialized. Call initPublisher() first.')
    return emitter as unknown as Publisher
  }
  return getIO() as unknown as Publisher
}

/**
 * Open sockets cache the user's display name (typing indicator). The emitter can't reach remote
 * sockets directly, so in standalone mode every realtime instance is told to update its own.
 */
export async function updateCachedUserName(userId: string, name: string) {
  if (env.REALTIME_MODE === 'standalone') {
    // The emitter's serverSideEmit is untyped: keep the payload checked against ServerSideEvents
    const payload: Parameters<ServerSideEvents['user:renamed']>[0] = { userId, name }
    emitter?.serverSideEmit('user:renamed', payload)
    return
  }

  const io = getIO()
  const sockets = await io.local.in(rooms.user(userId)).fetchSockets()
  sockets.forEach((socket) => { socket.data.name = name })
  // Other embedded instances (Redis adapter) receive it as a server-side event
  if (redisEnabled) io.serverSideEmit('user:renamed', { userId, name })
}
