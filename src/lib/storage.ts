import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { env } from '@/env'

/**
 * Minimal storage abstraction. Only a local-disk driver exists today; an S3/MinIO driver
 * can implement the same interface later without touching the controllers.
 */
export interface StorageDriver {
  put(key: string, data: Buffer): Promise<void>
  delete(key: string): Promise<void>
  /** Path (relative to the API origin) where the file can be fetched */
  publicPath(key: string): string
}

export const UPLOADS_ROUTE = '/uploads'
export const uploadsDir = path.resolve(env.UPLOADS_DIR)

function resolveKey(key: string) {
  // Keys are generated server side, but never trust a path to stay inside the uploads folder
  const target = path.resolve(uploadsDir, key)
  if (!target.startsWith(uploadsDir + path.sep)) throw new Error(`Invalid storage key: ${key}`)
  return target
}

class LocalStorage implements StorageDriver {
  async put(key: string, data: Buffer) {
    const target = resolveKey(key)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, data)
  }

  async delete(key: string) {
    await rm(resolveKey(key), { force: true })
  }

  publicPath(key: string) {
    return `${UPLOADS_ROUTE}/${key}`
  }
}

export const storage: StorageDriver = new LocalStorage()

/** Inverse of publicPath, for files whose path is stored (e.g. avatars). */
export function keyFromPublicPath(publicPath: string | null | undefined) {
  const prefix = `${UPLOADS_ROUTE}/`
  return publicPath?.startsWith(prefix) ? publicPath.slice(prefix.length) : null
}

/** Best effort: a missing file must never fail the request that removes its record. */
export async function deleteQuietly(keys: (string | null | undefined)[]) {
  await Promise.all(
    keys.filter((key): key is string => !!key).map((key) =>
      storage.delete(key).catch((error) => console.error('[storage] delete failed', key, error)),
    ),
  )
}
