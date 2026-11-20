import { createHash, randomBytes } from 'node:crypto'
import { sign, type SignOptions } from 'jsonwebtoken'

import { env } from '@/env'
import { prisma } from '@/http/lib/prisma'

const DAY_MS = 24 * 60 * 60 * 1000

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

/** Issues a new access token (JWT) and a new single-use refresh token for the user. */
export async function issueSession(user: { id: string; email: string }) {
  const token = sign({ id: user.id, email: user.email }, env.JWT_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL as SignOptions['expiresIn'],
    subject: user.id,
  })

  const refreshToken = randomBytes(48).toString('base64url')
  await prisma.token.create({
    data: {
      type: 'REFRESH',
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_DAYS * DAY_MS),
    },
  })

  return { token, refreshToken }
}

/** Ends every session of the user (password reset), optionally keeping one refresh token. */
export async function revokeRefreshTokens(userId: string, keepTokenHash?: string) {
  await prisma.token.deleteMany({
    where: { userId, type: 'REFRESH', ...(keepTokenHash ? { NOT: { tokenHash: keepTokenHash } } : {}) },
  })
}
