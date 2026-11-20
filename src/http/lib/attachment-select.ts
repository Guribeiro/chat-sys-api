import type { Prisma } from '@prisma/client'
import { storage } from '@/lib/storage'

export const attachmentSelect = {
  id: true,
  name: true,
  mime: true,
  size: true,
  width: true,
  height: true,
  storageKey: true,
  thumbnailKey: true,
} satisfies Prisma.AttachmentSelect

type AttachmentRow = Prisma.AttachmentGetPayload<{ select: typeof attachmentSelect }>

/** What clients see: public paths instead of storage keys. */
export function toAttachmentPayload({ storageKey, thumbnailKey, ...attachment }: AttachmentRow) {
  return {
    ...attachment,
    url: storage.publicPath(storageKey),
    thumbnailUrl: thumbnailKey ? storage.publicPath(thumbnailKey) : null,
  }
}

export type AttachmentPayload = ReturnType<typeof toAttachmentPayload>
