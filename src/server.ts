import { createServer } from 'http'

import { app } from './app'
import { env } from '@/env'
import { closeRedis } from '@/lib/redis'
import { closeSocket, initSocket } from '@/socket'
import { initPublisher } from '@/socket/publisher'
import { scheduleAttachmentCleanup } from '@/lib/cleanup-attachments'

async function main() {
  const server = createServer(app)

  if (env.REALTIME_MODE === 'embedded') {
    // The same HTTP server serves both the Express app and the Socket.io connections
    await initSocket(server)
  } else {
    // Socket.io runs in src/realtime-server.ts; here we only publish events through Redis
    await initPublisher()
  }

  scheduleAttachmentCleanup()

  server.listen(env.PORT, () => {
    console.log(`Server running on port ${env.PORT} (realtime: ${env.REALTIME_MODE})`)
  })

  const shutdown = async () => {
    await closeSocket()
    server.close()
    await closeRedis()
    process.exit(0)
  }
  process.once('SIGTERM', shutdown)
  process.once('SIGINT', shutdown)
}

main().catch((error) => {
  console.error('[api] failed to start', error)
  process.exit(1)
})
