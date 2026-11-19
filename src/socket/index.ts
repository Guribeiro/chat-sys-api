import type { Server as HttpServer } from 'http'
import { Server } from 'socket.io'

import { env } from '@/env'
import { prisma } from '@/http/lib/prisma'
import { socketAuth } from './auth'
import {
  rooms,
  type ClientToServerEvents,
  type ServerToClientEvents,
  type SocketData,
} from './events'

export type IO = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>

let io: IO | null = null

// userId -> number of open sockets (one user may have several tabs)
const presence = new Map<string, number>()

function onlineUserIds() {
  return Array.from(presence.keys())
}

async function findChannelForMember(slug: string, userId: string) {
  return prisma.channel.findFirst({
    where: { slug, members: { some: { memberId: userId } } },
    select: { id: true },
  })
}

export function initSocket(httpServer: HttpServer): IO {
  io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(httpServer, {
    cors: { origin: env.WEB_URL.split(',').map((origin) => origin.trim()) },
  })

  io.use(socketAuth)

  io.on('connection', (socket) => {
    const { userId } = socket.data

    socket.join(rooms.user(userId))

    const count = presence.get(userId) ?? 0
    presence.set(userId, count + 1)

    socket.emit('presence:snapshot', onlineUserIds())
    if (count === 0) {
      socket.broadcast.emit('presence:update', onlineUserIds())
    }

    socket.on('channel:join', async ({ slug }, ack) => {
      try {
        const channel = await findChannelForMember(slug, userId)
        if (!channel) {
          return ack?.({ ok: false, error: 'Channel not found or you are not a member' })
        }
        await socket.join(rooms.channel(channel.id))
        ack?.({ ok: true, channelId: channel.id })
      } catch (error) {
        console.error('[socket] channel:join failed', error)
        ack?.({ ok: false, error: 'Internal error' })
      }
    })

    socket.on('channel:leave', async ({ slug }) => {
      const channel = await prisma.channel.findUnique({ where: { slug }, select: { id: true } })
      if (channel) await socket.leave(rooms.channel(channel.id))
    })

    socket.on('disconnect', () => {
      const remaining = (presence.get(userId) ?? 1) - 1
      if (remaining > 0) {
        presence.set(userId, remaining)
        return
      }
      presence.delete(userId)
      io?.emit('presence:update', onlineUserIds())
    })
  })

  return io
}

export function getIO(): IO {
  if (!io) throw new Error('Socket.io not initialized. Call initSocket() first.')
  return io
}

export { rooms }
