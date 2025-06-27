import { Request, Response } from 'express'
import { prisma } from '@/http/lib/prisma'
import { BadRequestError } from '@/http/_errors/bad-request-error'
import { compare } from 'bcryptjs'
import { sign } from 'jsonwebtoken'

export class AuthenticateWithPasswordController {
  public async handle(request: Request, response: Response) {
    const { email, password } = request.body

    const userFromEmail = await prisma.user.findUnique({
      where: {
        email
      },
    })

    if (!userFromEmail) {
      throw new BadRequestError('invalid credentials')
    }

    const isPasswordValid = await compare(password, userFromEmail.password)

    if (!isPasswordValid) {
      throw new BadRequestError('invalid credentials')
    }


    const token = sign({
      id: userFromEmail.id,
      email: userFromEmail.email,
    },
      'secret',
      {
        expiresIn: '1d',
        subject: userFromEmail.id,
      }
    )

    return response.status(200).json({
      token,
      user: {
        id: userFromEmail.id,
        name: userFromEmail.name,
        email: userFromEmail.email,
      }
    })
  }
}