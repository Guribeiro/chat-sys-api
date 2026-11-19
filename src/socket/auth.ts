import type { Socket } from 'socket.io'
import { verify } from 'jsonwebtoken'

import { env } from '@/env'

export function socketAuth(socket: Socket, next: (err?: Error) => void) {
  const raw = socket.handshake.auth?.token as string | undefined
  // Accept both "<token>" and "Bearer <token>"
  const token = raw?.replace(/^bearer\s+/i, '')

  if (!token) {
    return next(new Error('unauthorized'))
  }

  try {
    const { sub } = verify(token, env.JWT_SECRET) as { sub: string }
    socket.data.userId = sub
    return next()
  } catch {
    return next(new Error('unauthorized'))
  }
}
