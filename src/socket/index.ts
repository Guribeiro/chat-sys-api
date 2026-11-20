import type { Server as HttpServer } from 'http'
import { Server } from 'socket.io'
import { createAdapter } from '@socket.io/redis-adapter'

import { env } from '@/env'
import { prisma } from '@/http/lib/prisma'
import { getRedis, redisEnabled } from '@/lib/redis'
import { socketAuth } from './auth'
import {
  rooms,
  type ClientToServerEvents,
  type ServerSideEvents,
  type ServerToClientEvents,
  type SocketData,
} from './events'
import { createMemoryPresence, createRedisPresence, type Presence } from './presence'

export type IO = Server<ClientToServerEvents, ServerToClientEvents, ServerSideEvents, SocketData>

let io: IO | null = null
let presence: Presence | null = null

async function findChannelForMember(slug: string, userId: string) {
  return prisma.channel.findFirst({
    where: { slug, members: { some: { memberId: userId } } },
    select: { id: true },
  })
}

/**
 * Starts Socket.io on the given HTTP server. With REDIS_URL, the Redis adapter relays emits and
 * room operations to every other instance, and presence is shared through Redis too.
 */
export async function initSocket(httpServer: HttpServer): Promise<IO> {
  const server: IO = new Server(httpServer, {
    cors: { origin: env.WEB_URL.split(',').map((origin) => origin.trim()) },
  })

  if (redisEnabled) {
    const { pub, sub } = await getRedis()
    server.adapter(createAdapter(pub, sub))
    presence = createRedisPresence(pub)
  } else {
    presence = createMemoryPresence()
  }
  const online = presence

  server.use(socketAuth)

  // Sent by another instance (or by the API through the emitter): each instance updates its own sockets
  server.on('user:renamed', async ({ userId, name }) => {
    const sockets = await server.local.in(rooms.user(userId)).fetchSockets()
    sockets.forEach((socket) => { socket.data.name = name })
  })

  server.on('connection', async (socket) => {
    const { userId } = socket.data

    socket.join(rooms.user(userId))

    socket.on('channel:join', async ({ slug }, ack) => {
      try {
        const channel = await findChannelForMember(slug, userId)
        if (!channel) {
          return ack?.({ ok: false, error: 'Canal não encontrado ou você não é membro dele' })
        }
        await socket.join(rooms.channel(channel.id))
        ack?.({ ok: true, channelId: channel.id })
      } catch (error) {
        console.error('[socket] channel:join failed', error)
        ack?.({ ok: false, error: 'Não foi possível entrar no canal. Tente de novo.' })
      }
    })

    socket.on('channel:leave', async ({ slug }) => {
      const channel = await prisma.channel.findUnique({ where: { slug }, select: { id: true } })
      if (channel) await socket.leave(rooms.channel(channel.id))
    })

    // Ephemeral: relayed to the rest of the room, never stored. Only for rooms this socket joined.
    socket.on('channel:typing', async ({ channelId }) => {
      if (typeof channelId !== 'string' || !socket.rooms.has(rooms.channel(channelId))) return

      if (socket.data.name === undefined) {
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } })
        socket.data.name = user?.name ?? null
      }

      socket.to(rooms.channel(channelId)).emit('channel:typing', { channelId, userId, name: socket.data.name })
    })

    socket.on('disconnect', async () => {
      try {
        if (await online.remove(userId)) server.emit('presence:update', await online.list())
      } catch (error) {
        console.error('[socket] presence remove failed', error)
      }
    })

    try {
      const wentOnline = await online.add(userId)
      socket.emit('presence:snapshot', await online.list())
      if (wentOnline) socket.broadcast.emit('presence:update', await online.list())
    } catch (error) {
      console.error('[socket] presence add failed', error)
    }
  })

  io = server
  return server
}

export function getIO(): IO {
  if (!io) throw new Error('Socket.io not initialized. Call initSocket() first.')
  return io
}

/** Graceful shutdown: drop this instance's presence and close connections (clients reconnect elsewhere). */
export async function closeSocket() {
  if (!io) return
  const server = io
  io = null
  await presence?.close()
  server.emit('presence:update', (await presence?.list()) ?? [])
  presence = null
  await new Promise<void>((resolve) => server.close(() => resolve()))
}

export { rooms }
