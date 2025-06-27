import { BadRequestError } from "@/http/_errors/bad-request-error"
import { prisma } from "@/http/lib/prisma"
import { Request, Response } from 'express'

export class RevokeInviteController {
  async handle(request: Request, response: Response) {
    const userId = request.user.id
    const { slug, inviteId } = request.params

    const channel = await prisma.channel.findUnique({
      where: {
        slug,
      },
    })

    if (!channel) {
      throw new BadRequestError('Channel not found')
    }

    const invite = await prisma.invite.findUnique({
      where: {
        id: inviteId
      }
    })

    if (!invite) {
      throw new BadRequestError('Invite not found')
    }

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
    })

    if (!user) {
      throw new BadRequestError('User not found.')
    }

    if (invite.authorId !== userId) {
      throw new BadRequestError('You are not the author of this invite')
    }

    await prisma.invite.delete({
      where: {
        id: inviteId,
      },
    })

    return response.status(204).send()
  }
}