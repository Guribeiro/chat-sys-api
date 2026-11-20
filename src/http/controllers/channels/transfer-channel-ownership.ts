import { Request, Response } from 'express'
import { prisma } from '@/http/lib/prisma'
import { BadRequestError, ForbiddenError, NotFoundError } from '@/http/_errors'
import { ensureGroupChannel } from '@/http/lib/ensure-group-channel'
import { getMembership } from '@/http/lib/get-membership'
import { rooms } from '@/socket'
import { getPublisher } from '@/socket/publisher'

/** Hands the channel to another member, who becomes ADMIN. The previous owner stays ADMIN. */
export class TransferChannelOwnershipController {
  public async handle(request: Request, response: Response) {
    const { slug } = request.params
    const { memberId } = request.body as { memberId: string }
    const userId = request.user.id

    const { channel, isOwner } = await getMembership(slug, userId)
    ensureGroupChannel(channel)

    if (!isOwner) {
      throw new ForbiddenError('Somente o dono do canal pode transferir a posse')
    }

    const target = await prisma.member.findFirst({ where: { id: memberId, channelId: channel.id } })

    if (!target) {
      throw new NotFoundError('Membro não encontrado')
    }

    if (target.memberId === userId) {
      throw new BadRequestError('Você já é o dono deste canal')
    }

    await prisma.$transaction([
      prisma.member.update({ where: { id: target.id }, data: { role: 'ADMIN' } }),
      prisma.member.updateMany({ where: { channelId: channel.id, memberId: userId }, data: { role: 'ADMIN' } }),
      prisma.channel.update({ where: { id: channel.id }, data: { ownerId: target.memberId } }),
    ])

    getPublisher().to(rooms.channel(channel.id)).emit('channel:owner_changed', {
      channelId: channel.id,
      previousOwnerId: userId,
      ownerId: target.memberId,
    })

    return response.status(204).send()
  }
}
