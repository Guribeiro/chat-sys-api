import { Request, Response } from 'express'
import { prisma } from '@/http/lib/prisma'
import { BadRequestError } from '@/http/_errors'
import { hash } from 'bcryptjs'
import { revokeRefreshTokens } from '@/lib/session'

export class ResetPasswordController {
  public async handle(request: Request, response: Response) {
    const { code, password } = request.body as { code: string; password: string }

    const tokenFromCode = await prisma.token.findFirst({
      where: {
        id: code,
        type: 'PASSWORD_RECOVER',
      }
    })

    // Tokens without expiresAt were created before expiration existed: treat them as expired
    if (!tokenFromCode || !tokenFromCode.expiresAt || tokenFromCode.expiresAt < new Date()) {
      throw new BadRequestError('invalid token')
    }

    const passwordHashed = await hash(password, 8)

    // Update the password and consume every recovery token of the user (single use)
    await prisma.$transaction([
      prisma.user.update({
        data: { password: passwordHashed },
        where: { id: tokenFromCode.userId },
      }),
      prisma.token.deleteMany({
        where: { userId: tokenFromCode.userId, type: 'PASSWORD_RECOVER' },
      }),
    ])

    // A new password ends every existing session (e.g. a stolen device)
    await revokeRefreshTokens(tokenFromCode.userId)

    return response.status(201).send()
  }
}
