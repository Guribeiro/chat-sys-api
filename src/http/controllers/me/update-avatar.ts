import { Request, Response } from 'express'
import { prisma } from '@/http/lib/prisma'
import { BadRequestError } from '@/http/_errors'
import { userSummarySelect } from '@/http/lib/message-select'
import { deleteQuietly, keyFromPublicPath, storage } from '@/lib/storage'
import { IMAGE_TYPES, newKey, processAvatar } from '@/lib/uploads'

export class UpdateAvatarController {
  public async handle(request: Request, response: Response) {
    const userId = request.user.id
    const file = request.file

    if (!file) throw new BadRequestError('No image was sent (use the "avatar" field)')
    if (!IMAGE_TYPES[file.mimetype]) throw new BadRequestError('The avatar must be an image')

    // Always re-encoded: fixed size, no metadata (EXIF/GPS) leaks
    const avatar = await processAvatar(file.buffer)
    const key = newKey(`avatars/${userId}`, 'webp')
    await storage.put(key, avatar)

    const previous = await prisma.user.findUnique({ where: { id: userId }, select: { avatarUrl: true } })
    const user = await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: storage.publicPath(key) },
      select: userSummarySelect,
    })
    await deleteQuietly([keyFromPublicPath(previous?.avatarUrl)])

    return response.status(200).json(user)
  }
}

export class DeleteAvatarController {
  public async handle(request: Request, response: Response) {
    const userId = request.user.id
    const previous = await prisma.user.findUnique({ where: { id: userId }, select: { avatarUrl: true } })

    const user = await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: null },
      select: userSummarySelect,
    })
    await deleteQuietly([keyFromPublicPath(previous?.avatarUrl)])

    return response.status(200).json(user)
  }
}
