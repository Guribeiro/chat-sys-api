import { z } from 'zod'

const id = z.string().uuid()
const email = z.string().trim().toLowerCase().email()
const password = z.string().min(6).max(128)

export const slugParams = z.object({ slug: z.string().min(1).max(200) })
export const memberParams = slugParams.extend({ memberId: id })
export const channelInviteParams = slugParams.extend({ inviteId: id })
export const inviteParams = z.object({ inviteId: id })
export const messageParams = slugParams.extend({ messageId: id })

// Auth
export const createAccountBody = z.object({
  name: z.string().trim().min(1).max(100),
  email,
  password,
})
export const authenticateBody = z.object({
  email,
  password: z.string().min(1).max(128),
})
export const requestPasswordRecoverBody = z.object({ email })
export const resetPasswordBody = z.object({ code: id, password })
export const refreshTokenBody = z.object({ refreshToken: z.string().min(20).max(200) })

// Profile
export const updateProfileBody = z.object({ name: z.string().trim().min(1).max(100) })
export const changePasswordBody = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: password,
  /** Keeps this device logged in while every other session is revoked */
  refreshToken: z.string().max(200).optional(),
})

// Direct messages and search
export const directMessageBody = z.object({ userId: id })
export const searchQuery = z.object({
  q: z.string().trim().min(2).max(100),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

// Channels
export const channelBody = z.object({
  title: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).nullish(),
})
export const channelStatusBody = z.object({ status: z.enum(['ATIVO', 'INATIVO']) })
const messageContent = z.string().trim().min(1).max(4000)
export const createMessageBody = z.object({
  content: z.string().trim().max(4000).optional(),
  replyToId: id.optional(),
  attachmentIds: z.array(id).max(5).optional(),
}).refine((body) => !!body.content || !!body.attachmentIds?.length, {
  message: 'A mensagem precisa de texto ou de pelo menos um anexo',
  path: ['content'],
})
export const updateMessageBody = z.object({ content: messageContent })
export const reactionBody = z.object({
  // A single emoji (possibly with skin tone / ZWJ sequences), never arbitrary text
  emoji: z.string().trim().min(1).max(32).regex(/^(?=.*\p{Extended_Pictographic})[\p{Extended_Pictographic}\p{Emoji_Component}\u200d\ufe0f]+$/u, 'Emoji inválido'),
})
export const channelNotificationsBody = z.object({ muted: z.boolean() })
export const messagesQuery = z.object({
  cursor: id.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
})
export const memberRoleBody = z.object({ role: z.enum(['ADMIN', 'MEMBER']) })
export const transferOwnershipBody = z.object({ memberId: id })
export const createInviteBody = z.object({
  invitee_id: id,
  role: z.enum(['ADMIN', 'MEMBER']).default('MEMBER'),
})

// Users
export const listUsersQuery = z.object({
  q: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(100),
})

// Me
export const memberChannelsQuery = z.object({
  status: z.enum(['active', 'deactive']).optional(),
  role: z.enum(['ADMIN', 'MEMBER']).optional(),
})
export const activityQuery = z.object({
  cursor: id.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})
