import { Request, Response } from 'express'
import { prisma } from '@/http/lib/prisma'
import { passwordRecoverMail, sendMail, webUrl } from '@/lib/mail'

export const PASSWORD_RECOVER_TTL_MS = 60 * 60 * 1000 // 1 hour

export class RequestPasswordRecoverController {
  public async handle(request: Request, response: Response) {
    const { email } = request.body as { email: string }

    const userFromEmail = await prisma.user.findUnique({
      where: {
        email
      },
    })

    // Same response whether the e-mail exists or not, to avoid user enumeration
    if (!userFromEmail) {
      return response.status(201).send()
    }

    // Only the most recent recovery code stays valid
    const [, { id: code }] = await prisma.$transaction([
      prisma.token.deleteMany({
        where: { userId: userFromEmail.id, type: 'PASSWORD_RECOVER' },
      }),
      prisma.token.create({
        data: {
          userId: userFromEmail.id,
          type: 'PASSWORD_RECOVER',
          expiresAt: new Date(Date.now() + PASSWORD_RECOVER_TTL_MS),
        }
      }),
    ])

    // Never fail (or reveal anything) because of e-mail delivery: log and answer the same way
    await sendMail(passwordRecoverMail(userFromEmail.email, userFromEmail.name, `${webUrl()}/reset-password/${code}`))
      .catch((error) => console.error('[mail] password recover e-mail failed', error))

    return response.status(201).send()
  }
}
