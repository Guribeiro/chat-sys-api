import { ensureGroupChannel } from '@/http/lib/ensure-group-channel'
import { Request, Response } from 'express'
import { prisma } from '@/http/lib/prisma'
import { BadRequestError, ForbiddenError, NotFoundError } from '@/http/_errors'
import { getAdminMembership } from '@/http/lib/get-membership'
import { rooms } from '@/socket'
import { getPublisher } from '@/socket/publisher'

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
      throw new NotFoundError('Membro não encontrado')
    }

    if (memberFromChannel.memberId === channel.ownerId) {
      throw new BadRequestError('O dono do canal não pode ser removido')
    }

    // Admins may remove members; only the owner may remove other admins
    if (memberFromChannel.role === 'ADMIN' && !isOwner) {
      throw new ForbiddenError('Somente o dono do canal pode remover um administrador')
    }

    await prisma.member.delete({
      where: {
        id: memberFromChannel.id,
      }
    })

    const io = getPublisher()
    const channelRoom = rooms.channel(channel.id)
    const payload = { channelId: channel.id, userId: memberFromChannel.memberId }

    // Notify the channel and the removed user, then pull their sockets out of the room
    io.to(channelRoom).to(rooms.user(memberFromChannel.memberId)).emit('channel:member_removed', payload)
    io.in(rooms.user(memberFromChannel.memberId)).socketsLeave(channelRoom)

    return response.status(204).send()
  }
}
