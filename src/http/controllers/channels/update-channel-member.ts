import type { Role } from '@prisma/client'
import { Request, Response } from 'express'
import { prisma } from '@/http/lib/prisma'
import { BadRequestError, ForbiddenError, NotFoundError } from '@/http/_errors'
import { ensureGroupChannel } from '@/http/lib/ensure-group-channel'
import { getAdminMembership } from '@/http/lib/get-membership'
import { getIO, rooms } from '@/socket'

/**
 * Changes a member's role. Admins may promote members; only the owner may demote admins.
 * Nobody changes the owner's role (ownership moves through transfer-ownership) or their own.
 */
export class UpdateChannelMemberController {
  public async handle(request: Request, response: Response) {
    const { slug, memberId } = request.params
    const { role } = request.body as { role: Role }
    const userId = request.user.id

    const { channel, isOwner } = await getAdminMembership(slug, userId)
    ensureGroupChannel(channel)

    const target = await prisma.member.findFirst({ where: { id: memberId, channelId: channel.id } })

    if (!target) {
      throw new NotFoundError('Membro não encontrado')
    }

    if (target.memberId === channel.ownerId) {
      throw new BadRequestError('O papel do dono do canal não pode ser alterado')
    }

    if (target.memberId === userId) {
      throw new BadRequestError('Você não pode alterar o seu próprio papel')
    }

    if (target.role === 'ADMIN' && role === 'MEMBER' && !isOwner) {
      throw new ForbiddenError('Somente o dono do canal pode remover um administrador')
    }

    const updated = target.role === role
      ? target
      : await prisma.member.update({ where: { id: target.id }, data: { role } })

    getIO()
      .to(rooms.channel(channel.id))
      .to(rooms.user(target.memberId))
      .emit('channel:member_updated', { channelId: channel.id, userId: target.memberId, role: updated.role })

    return response.status(200).json({ ...updated, isOwner: false })
  }
}
