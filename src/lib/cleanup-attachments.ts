import { prisma } from '@/http/lib/prisma'
import { deleteQuietly } from './storage'

const PENDING_TTL_MS = 24 * 60 * 60 * 1000
const INTERVAL_MS = 60 * 60 * 1000

/** Removes uploads that were never attached to a message (user gave up sending). */
export async function cleanupPendingAttachments() {
  const stale = await prisma.attachment.findMany({
    where: { messageId: null, createdAt: { lt: new Date(Date.now() - PENDING_TTL_MS) } },
    select: { id: true, storageKey: true, thumbnailKey: true },
  })
  if (!stale.length) return

  await prisma.attachment.deleteMany({ where: { id: { in: stale.map(({ id }) => id) } } })
  await deleteQuietly(stale.flatMap(({ storageKey, thumbnailKey }) => [storageKey, thumbnailKey]))
  console.log(`[attachments] removed ${stale.length} pending upload(s)`)
}

export function scheduleAttachmentCleanup() {
  const run = () => cleanupPendingAttachments().catch((error) => console.error('[attachments] cleanup failed', error))
  run()
  return setInterval(run, INTERVAL_MS).unref()
}
