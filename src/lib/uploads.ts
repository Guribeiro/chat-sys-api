import multer from 'multer'
import sharp from 'sharp'
import { randomUUID } from 'node:crypto'

import { env } from '@/env'
import { BadRequestError } from '@/http/_errors'

export const MAX_FILES_PER_MESSAGE = 5

/** Images are re-encoded/validated with sharp; everything else is stored as-is and served as a download. */
export const IMAGE_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

export const DOCUMENT_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'application/json': 'json',
  'application/zip': 'zip',
  'application/x-zip-compressed': 'zip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
}

const ALLOWED_TYPES = { ...IMAGE_TYPES, ...DOCUMENT_TYPES }

/** Files are kept in memory: they are small (size-limited) and go straight to storage. */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: MAX_FILES_PER_MESSAGE },
  fileFilter: (_request, file, callback) => {
    if (ALLOWED_TYPES[file.mimetype]) return callback(null, true)
    callback(new BadRequestError(`File type not allowed: ${file.mimetype || 'unknown'}`))
  },
})

/** Multer decodes multipart file names as latin1; also strip anything path-like. */
export function cleanFileName(originalName: string) {
  const decoded = Buffer.from(originalName, 'latin1').toString('utf8')
  const base = decoded.replace(/[/\\]/g, '_').replace(/[\u0000-\u001f\u007f]/g, '').trim()
  return (base || 'arquivo').slice(0, 200)
}

export type ProcessedImage = {
  width: number | null
  height: number | null
  thumbnail: Buffer
}

/** Validates that the bytes really are an image (not just the declared mime) and builds a thumbnail. */
export async function processImage(buffer: Buffer): Promise<ProcessedImage> {
  try {
    const image = sharp(buffer, { animated: false })
    const metadata = await image.metadata()
    const thumbnail = await image
      .rotate() // honour EXIF orientation
      .resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer()

    const rotated = (metadata.orientation ?? 1) >= 5
    return {
      width: (rotated ? metadata.height : metadata.width) ?? null,
      height: (rotated ? metadata.width : metadata.height) ?? null,
      thumbnail,
    }
  } catch {
    throw new BadRequestError('O arquivo de imagem é inválido ou está corrompido')
  }
}

export async function processAvatar(buffer: Buffer): Promise<Buffer> {
  try {
    return await sharp(buffer, { animated: false })
      .rotate()
      .resize(256, 256, { fit: 'cover' })
      .webp({ quality: 85 })
      .toBuffer()
  } catch {
    throw new BadRequestError('O arquivo de imagem é inválido ou está corrompido')
  }
}

export function newKey(folder: string, extension: string) {
  return `${folder}/${randomUUID()}.${extension}`
}
