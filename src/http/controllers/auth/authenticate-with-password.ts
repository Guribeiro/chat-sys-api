import { Request, Response } from 'express'
import { prisma } from '@/http/lib/prisma'
import { BadRequestError } from '@/http/_errors/bad-request-error'
import { compare } from 'bcryptjs'
import { issueSession } from '@/lib/session'

export class AuthenticateWithPasswordController {
  public async handle(request: Request, response: Response) {
    const { email, password } = request.body as { email: string; password: string }

    const userFromEmail = await prisma.user.findUnique({
      where: {
        email
      },
    })

    if (!userFromEmail) {
      throw new BadRequestError('E-mail ou senha incorretos')
    }

    const isPasswordValid = await compare(password, userFromEmail.password)

    if (!isPasswordValid) {
      throw new BadRequestError('E-mail ou senha incorretos')
    }

    const { token, refreshToken } = await issueSession(userFromEmail)

    return response.status(200).json({
      token,
      refreshToken,
      user: {
        id: userFromEmail.id,
        name: userFromEmail.name,
        email: userFromEmail.email,
        avatarUrl: userFromEmail.avatarUrl,
      }
    })
  }
}
