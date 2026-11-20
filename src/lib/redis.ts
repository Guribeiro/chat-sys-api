import { createClient } from 'redis'

import { env } from '@/env'

export type RedisClient = ReturnType<typeof createClient>

export const redisEnabled = Boolean(env.REDIS_URL)

let pubClient: RedisClient | null = null
let subClient: RedisClient | null = null

/**
 * Connected Redis clients, created on first use. Pub/sub needs a dedicated connection (a client in
 * subscriber mode cannot run regular commands), so `sub` is a duplicate of `pub`.
 */
export async function getRedis(): Promise<{ pub: RedisClient; sub: RedisClient }> {
  if (!env.REDIS_URL) throw new Error('REDIS_URL is not set')

  if (!pubClient || !subClient) {
    pubClient = createClient({ url: env.REDIS_URL })
    subClient = pubClient.duplicate()
    pubClient.on('error', (error) => console.error('[redis] pub client error', error))
    subClient.on('error', (error) => console.error('[redis] sub client error', error))
    await Promise.all([pubClient.connect(), subClient.connect()])
  }

  return { pub: pubClient, sub: subClient }
}

export async function closeRedis() {
  await Promise.all([pubClient?.quit(), subClient?.quit()])
  pubClient = subClient = null
}
