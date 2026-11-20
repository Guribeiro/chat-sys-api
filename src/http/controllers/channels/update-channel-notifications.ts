import { Request, Response } from 'express'
import { prisma } from '@/http/lib/prisma'
import { getMembership } from '@/http/lib/get-membership'

/** Mutes or unmutes a channel for the current user only. */
export class UpdateChannelNotificationsController {
  public async handle(request: Request, response: Response) {
    const { slug } = request.params
    const { muted } = request.body as { muted: boolean }

    const { member } = await getMembership(slug, request.user.id)

    await prisma.member.update({ where: { id: member.id }, data: { muted } })

    return response.status(200).json({ muted })
  }
}
