import { Request, Response } from 'express'
import { prisma } from '@/http/lib/prisma'
import { BadRequestError } from '@/http/_errors/bad-request-error'

import { UnauthorizedError } from '@/http/_errors/unauthorized-error'

export class RemoveChannelMemberController {
  public async handle(request: Request, response: Response) {
    const userId = request.user.id
    const { slug } = request.params
    const { memberId } = request.params


    const channelFromSlug = await prisma.channel.findUnique({
      where: {
        ownerId: userId,
        slug
      }
    })

    if (!channelFromSlug) {
      throw new BadRequestError('Channel not found')
    }

    if (channelFromSlug.ownerId !== userId) {
      throw new UnauthorizedError('You are not the owner of this channel')
    }


    const memberFromChannel = await prisma.member.findFirst({
      where: {
        channelId: channelFromSlug.id,
        id: memberId,
      }
    })


    if (!memberFromChannel) {
      throw new BadRequestError('Member not found')
    }

    await prisma.member.delete({
      where: {
        id: memberFromChannel.id,
      }
    })


    return response.status(204).send()
  }
}