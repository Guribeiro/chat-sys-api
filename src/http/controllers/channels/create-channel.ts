import { Request, Response } from 'express'
import { prisma } from '@/http/lib/prisma'
import { createSlug } from '@/utils/create-slug'
import { UnauthorizedError } from '@/http/_errors/unauthorized-error'

export class CreateChannelController {
  public async handle(request: Request, response: Response) {
    const userId = request.user.id
    const { title, description } = request.body

    const userFromId = await prisma.user.findUnique({
      where: {
        id: userId
      }
    })

    if (!userFromId) {
      throw new UnauthorizedError()
    }


    const slug = createSlug(title)

    const channel = await prisma.channel.create({
      data: {
        title,
        description,
        slug,
        ownerId: userId
      }
    })
    return response.status(200).json(channel)
  }
}