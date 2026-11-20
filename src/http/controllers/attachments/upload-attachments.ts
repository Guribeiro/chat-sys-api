import { Request, Response } from 'express'
import { prisma } from '@/http/lib/prisma'
import { BadRequestError } from '@/http/_errors'
import { getMembership } from '@/http/lib/get-membership'
import { ensureActiveChannel } from '@/http/lib/ensure-group-channel'
import { attachmentSelect, toAttachmentPayload } from '@/http/lib/attachment-select'
import { deleteQuietly, storage } from '@/lib/storage'
import { DOCUMENT_TYPES, IMAGE_TYPES, cleanFileName, newKey, processImage } from '@/lib/uploads'

/**
 * Step 1 of sending files: store them and return their ids. They stay "pending" (no message)
 * until a message references them; unused uploads are swept after a while.
 */
export class UploadAttachmentsController {
  public async handle(request: Request, response: Response) {
    const userId = request.user.id
    const { channel } = await getMembership(request.params.slug, userId)
    ensureActiveChannel(channel)

    const files = (request.files as Express.Multer.File[] | undefined) ?? []
    if (!files.length) {
      throw new BadRequestError('Nenhum arquivo foi enviado (use o campo "files")')
    }

    const written: string[] = []
    try {
      const attachments = []
      for (const file of files) {
        const folder = `attachments/${channel.id}`
        const isImage = !!IMAGE_TYPES[file.mimetype]
        const extension = IMAGE_TYPES[file.mimetype] ?? DOCUMENT_TYPES[file.mimetype]

        const image = isImage ? await processImage(file.buffer) : null

        const storageKey = newKey(folder, extension)
        await storage.put(storageKey, file.buffer)
        written.push(storageKey)

        let thumbnailKey: string | null = null
        if (image) {
          thumbnailKey = newKey(folder, 'webp')
          await storage.put(thumbnailKey, image.thumbnail)
          written.push(thumbnailKey)
        }

        attachments.push(await prisma.attachment.create({
          data: {
            name: cleanFileName(file.originalname),
            mime: file.mimetype,
            size: file.size,
            width: image?.width ?? null,
            height: image?.height ?? null,
            storageKey,
            thumbnailKey,
            channelId: channel.id,
            uploaderId: userId,
          },
          select: { ...attachmentSelect, id: true },
        }))
      }

      return response.status(201).json({ attachments: attachments.map(toAttachmentPayload) })
    } catch (error) {
      // Do not leave orphan files behind when one file of the batch fails
      await deleteQuietly(written)
      throw error
    }
  }
}
