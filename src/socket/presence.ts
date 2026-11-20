import { randomUUID } from 'node:crypto'

import type { RedisClient } from '@/lib/redis'

/**
 * Who is online. `add`/`remove` count sockets per user (one user may have several tabs) and
 * return true when the user went online/offline, i.e. when the online list changed.
 */
export interface Presence {
  add(userId: string): Promise<boolean>
  remove(userId: string): Promise<boolean>
  list(): Promise<string[]>
  close(): Promise<void>
}

/** Single process: a plain Map is the whole truth. */
export function createMemoryPresence(): Presence {
  const counts = new Map<string, number>()

  return {
    async add(userId) {
      const count = counts.get(userId) ?? 0
      counts.set(userId, count + 1)
      return count === 0
    },
    async remove(userId) {
      const remaining = (counts.get(userId) ?? 1) - 1
      if (remaining > 0) {
        counts.set(userId, remaining)
        return false
      }
      counts.delete(userId)
      return true
    },
    async list() {
      return Array.from(counts.keys())
    },
    async close() {
      counts.clear()
    },
  }
}

const SERVERS_KEY = 'presence:servers'
const TTL_SECONDS = 30
const HEARTBEAT_MS = 10_000

/**
 * Several processes: each one owns a hash `presence:<serverId>` (userId -> socket count) with a
 * short TTL renewed by a heartbeat. If a process dies without cleaning up, its hash expires and
 * its users drop off the list within TTL_SECONDS. The online list is the union of live hashes.
 */
export function createRedisPresence(redis: RedisClient): Presence {
  const serverId = randomUUID()
  const key = `presence:${serverId}`

  // The hash only exists while it has fields, so the TTL is kept on a separate marker key too
  const aliveKey = `${key}:alive`
  const heartbeat = async () => {
    await redis.multi().sAdd(SERVERS_KEY, serverId).set(aliveKey, '1', { EX: TTL_SECONDS }).expire(key, TTL_SECONDS).exec()
  }
  void heartbeat()
  const timer = setInterval(() => void heartbeat().catch((error) => console.error('[presence] heartbeat failed', error)), HEARTBEAT_MS)
  timer.unref()

  async function totalFor(userId: string) {
    const servers = await liveServers()
    const counts = await Promise.all(servers.map((id) => redis.hGet(`presence:${id}`, userId)))
    return counts.reduce((sum, value) => sum + Number(value ?? 0), 0)
  }

  async function liveServers() {
    const servers = await redis.sMembers(SERVERS_KEY)
    if (!servers.length) return []
    const alive = await Promise.all(servers.map((id) => redis.exists(`presence:${id}:alive`)))
    const dead = servers.filter((_, index) => !alive[index])
    if (dead.length) await redis.sRem(SERVERS_KEY, dead)
    return servers.filter((_, index) => alive[index])
  }

  return {
    async add(userId) {
      await redis.multi().hIncrBy(key, userId, 1).expire(key, TTL_SECONDS).exec()
      // Online "changed" only if this is the user's first socket across the whole cluster
      return (await totalFor(userId)) === 1
    },
    async remove(userId) {
      const remaining = await redis.hIncrBy(key, userId, -1)
      if (remaining <= 0) await redis.hDel(key, userId)
      return (await totalFor(userId)) === 0
    },
    async list() {
      const servers = await liveServers()
      const keys = await Promise.all(servers.map((id) => redis.hKeys(`presence:${id}`)))
      return Array.from(new Set(keys.flat()))
    },
    async close() {
      clearInterval(timer)
      await redis.multi().del([key, aliveKey]).sRem(SERVERS_KEY, serverId).exec()
    },
  }
}
