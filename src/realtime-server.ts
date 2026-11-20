import { createServer } from 'http'

import { env } from '@/env'
import { closeRedis } from '@/lib/redis'
import { closeSocket, initSocket } from '@/socket'

/**
 * Standalone realtime process: only Socket.io, no Express. Run as many as needed behind a load
 * balancer; the Redis adapter keeps them in sync, and the API publishes through the Redis emitter.
 */
async function main() {
  if (!env.REDIS_URL) throw new Error('The realtime server requires REDIS_URL')

  const server = createServer((_, response) => {
    // Plain HTTP requests only get a health check; Socket.io handles its own path (/socket.io)
    response.writeHead(200, { 'content-type': 'text/plain' }).end('ok')
  })

  await initSocket(server)

  server.listen(env.REALTIME_PORT, () => {
    console.log(`Realtime server running on port ${env.REALTIME_PORT}`)
  })

  const shutdown = async () => {
    await closeSocket()
    await closeRedis()
    process.exit(0)
  }
  process.once('SIGTERM', shutdown)
  process.once('SIGINT', shutdown)
}

main().catch((error) => {
  console.error('[realtime] failed to start', error)
  process.exit(1)
})
