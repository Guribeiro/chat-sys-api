import { ensureGroupChannel } from '@/http/lib/ensure-group-channel'
import { BadRequestError, NotFoundError } from "@/http/_errors"
import { prisma } from "@/http/lib/prisma"
import { getAdminMembership } from "@/http/lib/get-membership"
import { Request, Response } from 'express'
import type { Role } from '@prisma/client'

import { getIO, rooms } from '@/socket'

export class CreateInviteController {
  async handle(request: Request, response: Response) {
    const userId = request.user.id
    const { slug } = request.params
    const { invitee_id, role } = request.body as { invitee_id: string; role: Role }

    const { channel } = await getAdminMembership(slug, userId)
    ensureGroupChannel(channel)

    const invitee = await prisma.user.findUnique({
      where: {
        id: invitee_id,
      },
    })

    if (!invitee) {
      throw new NotFoundError('Invitee not found.')
    }

    const memberFromChannelAndInviteeId = await prisma.member.findUnique({
      where: { channelId_memberId: { channelId: channel.id, memberId: invitee.id } },
    })

    if (memberFromChannelAndInviteeId) {
      throw new BadRequestError('You can not invite someone who is already a member of this channel')
    }

    const inviteFromChannelAndInvitee = await prisma.invite.findUnique({
      where: { channelId_inviteeId: { channelId: channel.id, inviteeId: invitee.id } },
    })

    if (inviteFromChannelAndInvitee) {
      throw new BadRequestError('Invite already exists.')
    }

    const invite = await prisma.invite.create({
      data: {
        role,
        authorId: userId,
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
