import { BadRequestError } from "@/http/_errors/bad-request-error"
import { prisma } from "@/http/lib/prisma"
import { Request, Response } from 'express'

import { getIO, rooms } from '@/socket'

export class CreateInviteController {
  async handle(request: Request, response: Response) {
    const user_id = request.user.id
    const { slug } = request.params
    const { invitee_id, role = 'ADMIN' } = request.body

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
        id: user_id,
      },
    })

    if (!user) {
      throw new BadRequestError('User not found.')
    }

    const invitee = await prisma.user.findUnique({
      where: {
        id: invitee_id,
      },
    })

    if (!invitee) {
      throw new BadRequestError('Invitee not found.')
    }

    const memberFromChannelAndInviteeId = await prisma.member.findFirst({
      where: {
        channelId: channel.id,
        memberId: invitee.id,
      },
    })

    if (memberFromChannelAndInviteeId) {
      throw new BadRequestError('You can not invite someone who is already a member of this channel')
    }

    const inviteFromChannelAndInvitee = await prisma.invite.findFirst({
      where: {
        channelId: channel.id,
        inviteeId: invitee.id,
      },
    })

    if (inviteFromChannelAndInvitee) {
      throw new BadRequestError('Invite already exists.')
    }

    const invite = await prisma.invite.create({
      data: {
        role,
        authorId: user.id,
        channelId: channel.id,
        inviteeId: invitee.id,
      },
      include: {
        author: { select: { id: true, name: true, email: true } },
        channel: { select: { id: true, title: true, description: true } },
      },
    })

    // Personal room: reaches every open tab of the invitee
    getIO().to(rooms.user(invitee.id)).emit('notification:new_invite', { invite })

    return response.status(201).send({
      inviteId: invite.id
    })
  }
}