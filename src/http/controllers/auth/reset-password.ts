import { Request, Response } from 'express'
import { prisma } from '@/http/lib/prisma'
import { BadRequestError } from '@/http/_errors'
import { hash } from 'bcryptjs'

export class ResetPasswordController {
  public async handle(request: Request, response: Response) {
    const { code, password } = request.body

    const tokenFromCode = await prisma.token.findFirst({
      where: {
        id: code,
        type: 'PASSWORD_RECOVER',
      }
    })

    if (!tokenFromCode) {
      throw new BadRequestError('invalid token')
    }

    const userFromToken = await prisma.user.findUnique({
      where: {
        id: tokenFromCode.userId
      },
    })

    if (!userFromToken) {
      throw new BadRequestError('invalid user')
    }

    const passwordHashed = await hash(password, 8)

    await prisma.user.update({
      data: {
        password: passwordHashed,
      },
      where: {
        id: userFromToken.id
      }
    })

    return response.status(201).send()
  }
}