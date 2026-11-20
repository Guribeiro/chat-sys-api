import { Request, Response } from 'express'
import { compare, hash } from 'bcryptjs'

import { prisma } from '@/http/lib/prisma'
import { BadRequestError, NotFoundError } from '@/http/_errors'
import { userSummarySelect } from '@/http/lib/message-select'
import { hashToken, revokeRefreshTokens } from '@/lib/session'
import { getIO, rooms } from '@/socket'

export class UpdateProfileController {
  public async handle(request: Request, response: Response) {
    const userId = request.user.id
    const { name } = request.body as { name: string }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { name },
      select: userSummarySelect,
    })

    // Open sockets cache the display name (typing indicator)
    const sockets = await getIO().in(rooms.user(userId)).fetchSockets()
    sockets.forEach((socket) => { socket.data.name = name })

    return response.status(200).json(user)
  }
}

export class ChangePasswordController {
  public async handle(request: Request, response: Response) {
    const userId = request.user.id
    const { currentPassword, newPassword, refreshToken } = request.body as {
      currentPassword: string
      newPassword: string
      refreshToken?: string
    }

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new NotFoundError('User not found')

    if (!(await compare(currentPassword, user.password))) {
      throw new BadRequestError('Current password is incorrect')
    }

    await prisma.user.update({ where: { id: userId }, data: { password: await hash(newPassword, 8) } })

    // Log out every other device, keep the one that made the change
    await revokeRefreshTokens(userId, refreshToken ? hashToken(refreshToken) : undefined)

    return response.status(204).send()
  }
}
