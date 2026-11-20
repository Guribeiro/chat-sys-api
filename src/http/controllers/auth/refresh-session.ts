import { Request, Response } from 'express'
import { prisma } from '@/http/lib/prisma'
import { UnauthorizedError } from '@/http/_errors'
import { hashToken, issueSession } from '@/lib/session'

/**
 * Exchanges a refresh token for a new access + refresh pair. Refresh tokens are single use
 * (rotation): the old one is deleted, so a stolen-and-reused token stops working.
 */
export class RefreshSessionController {
  public async handle(request: Request, response: Response) {
    const { refreshToken } = request.body as { refreshToken: string }

    const stored = await prisma.token.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      include: { user: { select: { id: true, email: true, name: true, avatarUrl: true } } },
    })

    if (!stored || stored.type !== 'REFRESH' || !stored.expiresAt || stored.expiresAt < new Date()) {
      if (stored) await prisma.token.delete({ where: { id: stored.id } }).catch(() => { })
      throw new UnauthorizedError('invalid_refresh_token')
    }

    // deleteMany (not delete) so two concurrent refreshes with the same token can not both win
    const { count } = await prisma.token.deleteMany({ where: { id: stored.id } })
    if (count === 0) throw new UnauthorizedError('invalid_refresh_token')

    const session = await issueSession(stored.user)
    return response.status(200).json({ ...session, user: stored.user })
  }
}

export class LogoutController {
  public async handle(request: Request, response: Response) {
    const { refreshToken } = request.body as { refreshToken: string }
    await prisma.token.deleteMany({ where: { tokenHash: hashToken(refreshToken), type: 'REFRESH' } })
    return response.status(204).send()
  }
}
