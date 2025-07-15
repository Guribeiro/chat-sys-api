import { Request, Response } from 'express'
import { prisma } from '@/http/lib/prisma'

export class RequestPasswordRecoverController {
  public async handle(request: Request, response: Response) {
    const { email } = request.body

    const userFromEmail = await prisma.user.findUnique({
      where: {
        email
      },
    })

    if (!userFromEmail) {
      return response.status(201).send()
    }

    const { id: code } = await prisma.token.create({
      data: {
        userId: userFromEmail.id,
        type: 'PASSWORD_RECOVER',
      }
    })

    //send recover password token to user's email
    console.log(`Recover password token ${code}`)

    return response.status(201).send()
  }
}