import { ensureGroupChannel } from '@/http/lib/ensure-group-channel'
import { Request, Response } from 'express'
import { prisma } from '@/http/lib/prisma'
import { BadRequestError, ForbiddenError, NotFoundError } from '@/http/_errors'
import { getAdminMembership } from '@/http/lib/get-membership'
import { getIO, rooms } from '@/socket'

export class RemoveChannelMemberController {
  public async handle(request: Request, response: Response) {
    const { slug, memberId } = request.params

    const { channel, isOwner } = await getAdminMembership(slug, request.user.id)
    ensureGroupChannel(channel)

    const memberFromChannel = await prisma.member.findFirst({
      where: {
        channelId: channel.id,
        id: memberId,
      }
    })

    if (!memberFromChannel) {
      throw new NotFoundError('Member not found')
    }

    if (memberFromChannel.memberId === channel.ownerId) {
      throw new BadRequestError('The channel owner can not be removed')
    }

    // Admins may remove members; only the owner may remove other admins
    if (memberFromChannel.role === 'ADMIN' && !isOwner) {
      throw new ForbiddenError('Only the channel owner can remove an admin')
    }

    await prisma.member.delete({
      where: {
        id: memberFromChannel.id,
      }
    })

    const io = getIO()
    const channelRoom = rooms.channel(channel.id)
    const payload = { channelId: channel.id, userId: memberFromChannel.memberId }

    // Notify the channel and the removed user, then pull their sockets out of the room
    io.to(channelRoom).to(rooms.user(memberFromChannel.memberId)).emit('channel:member_removed', payload)
    io.in(rooms.user(memberFromChannel.memberId)).socketsLeave(channelRoom)

    return response.status(204).send()
  }
}
