import { BadRequestError } from "@/http/_errors/bad-request-error"
import { prisma } from "@/http/lib/prisma"
import { Request, Response } from 'express'

export class CreateInviteController {
  async handle(request: Request, response: Response) {
    const userId = request.user.id
    const { slug } = request.params
    const { inviteeId, role } = request.body

    const channel = await prisma.channel.findUnique({
      where: {
        slug,
      },
    })

    if (!channel) {
      throw new BadRequestError('Channel not found')
    }

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
    })

    if (!user) {
      throw new BadRequestError('User not found.')
    }

    const invitee = await prisma.user.findUnique({
      where: {
        id: inviteeId,
      },
    })

    if (!invitee) {
      throw new BadRequestError('Invitee not found.')
    }

    const invite = await prisma.invite.create({
      data: {
        role,
        authorId: user.id,
        channelId: channel.id,
        inviteeId: invitee.id,
      }
    })

    return response.status(201).send({
      inviteId: invite.id
    })
  }
}