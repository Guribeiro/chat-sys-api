import { createServer } from 'node:http'
import { afterAll, beforeEach } from 'vitest'

import { app } from '@/app'
import { initSocket } from '@/socket'
import { prisma } from '@/http/lib/prisma'

// Controllers emit Socket.io events, so the server must exist (nobody listens in tests).
// Without REDIS_URL initSocket has no await before registering the server, so it is ready right away.
void initSocket(createServer(app))

beforeEach(async () => {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE reactions, mentions, attachments, messages, invites, members, channels, tokens, users CASCADE',
  )
})

afterAll(async () => {
  await prisma.$disconnect()
})
