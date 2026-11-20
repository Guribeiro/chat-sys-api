import { Request, Response } from 'express'
import { randomBytes } from 'node:crypto'

import { prisma } from '@/http/lib/prisma'
import { BadRequestError, NotFoundError } from '@/http/_errors'
import { userSummarySelect } from '@/http/lib/message-select'
import { getIO, rooms } from '@/socket'

/**
 * Opens (or reuses) the 1:1 conversation between me and another user. A DM is a regular
 * channel with type DIRECT and exactly two MEMBER rows, so messages, sockets, unread counts,
 * reactions and uploads all work unchanged.
 */
export class OpenDirectMessageController {
  public async handle(request: Request, response: Response) {
    const userId = request.user.id
    const { userId: peerId } = request.body as { userId: string }

    if (peerId === userId) {
      throw new BadRequestError('Você não pode abrir uma conversa com você mesmo')
    }

    const peer = await prisma.user.findUnique({ where: { id: peerId }, select: userSummarySelect })
    if (!peer) throw new NotFoundError('Usuário não encontrado')

    const existing = await prisma.channel.findFirst({
      where: {
        type: 'DIRECT',
        AND: [
          { members: { some: { memberId: userId } } },
          { members: { some: { memberId: peerId } } },
        ],
      },
    })

    if (existing) {
      return response.status(200).json({ ...existing, peer })
    }

    const channel = await prisma.channel.create({
      data: {
        type: 'DIRECT',
        title: 'Mensagem direta',
        slug: `dm-${randomBytes(6).toString('hex')}`,
        ownerId: userId,
        members: {
          createMany: {
            data: [
              { memberId: userId, role: 'MEMBER' },
              { memberId: peerId, role: 'MEMBER' },
            ],
          },
        },
      },
    })

    // The other person's sidebar picks the conversation up right away
    getIO().to(rooms.user(peerId)).emit('channel:member_added', { channelId: channel.id, userId: peerId })

    return response.status(201).json({ ...channel, peer })
  }
}
