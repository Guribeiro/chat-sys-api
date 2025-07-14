import { Request, Response } from 'express'
import { prisma } from '@/http/lib/prisma'
import { UnauthorizedError } from '@/http/_errors/unauthorized-error'
import { BadRequestError } from '@/http/_errors'

export class DeleteChannelController {
  public async handle(request: Request, response: Response) {
    const userId = request.user.id
    const { slug } = request.params

    const userFromId = await prisma.user.findUnique({
      where: {
        id: userId
      }
    })

    if (!userFromId) {
      throw new UnauthorizedError('You are not authorized to perform this action')
    }

    const member = await prisma.member.findFirst({
      where: {
        memberId: userId,
        role: 'ADMIN',
      }
    })

    if (!member) {
      throw new UnauthorizedError('You are not authorized to perform this action')
    }

    const channel = await prisma.channel.findUnique({
      where: {
        slug,
        ownerId: userFromId.id,
      }
    })

    if (!channel) {
      throw new BadRequestError('Channel not found')
    }

    await prisma.channel.delete({
      where: {
        id: channel.id,
      }
    })

    return response.status(204).send()
  }
}