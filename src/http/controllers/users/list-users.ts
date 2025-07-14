import { Request, Response } from 'express'
import { prisma } from '@/http/lib/prisma'

export class ListUsersController {
  public async handle(request: Request, response: Response) {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
      }
    })
    return response.status(200).json(users)
  }
}