import { Request, Response } from 'express'
import { prisma } from '@/http/lib/prisma'
import { createSlug } from '@/utils/create-slug'
import { BadRequestError } from '@/http/_errors'

export class CreateChannelController {
  public async handle(request: Request, response: Response) {
    const userId = request.user.id
    const { title, description } = request.body as { title: string; description?: string | null }

    const slug = createSlug(title)

    const slugTaken = await prisma.channel.findUnique({ where: { slug }, select: { id: true } })
    if (slugTaken) {
      throw new BadRequestError('A channel with this title already exists')
    }

    const channel = await prisma.channel.create({
      data: {
        title,
        description,
        slug,
        ownerId: userId,
        members: {
          create: {
            memberId: userId,
            role: 'ADMIN',
          }
        }
      }
    })
    return response.status(200).json(channel)
  }
}
