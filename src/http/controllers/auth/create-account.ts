import { Request, Response } from 'express'
import { prisma } from '@/http/lib/prisma'
import { BadRequestError } from '@/http/_errors/bad-request-error'
import { hash } from 'bcryptjs'

export class CreateAccountController {
  public async handle(request: Request, response: Response) {
    const { name, email, password } = request.body

    const userFromEmail = await prisma.user.findUnique({
      where: {
        email
      },
    })

    if (userFromEmail) {
      throw new BadRequestError('email is already been taken')
    }

    const passwordHashed = await hash(password, 6)

    await prisma.user.create({
      data: {
        email,
        password: passwordHashed,
        name
      }
    })

    return response.status(204).send()
  }
}