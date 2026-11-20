import { Request, Response } from 'express'
import { prisma } from '@/http/lib/prisma'
import { getMembership } from '@/http/lib/get-membership'

export class MarkChannelReadController {
  public async handle(request: Request, response: Response) {
    const { member } = await getMembership(request.params.slug, request.user.id)

    await prisma.member.update({
      where: { id: member.id },
      data: { lastReadAt: new Date() },
    })

    return response.status(204).send()
  }
}
