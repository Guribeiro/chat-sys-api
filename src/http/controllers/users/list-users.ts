import { userSummarySelect } from '@/http/lib/message-select'
import { Request, Response } from 'express'
import { prisma } from '@/http/lib/prisma'

export class ListUsersController {
  public async handle(request: Request, response: Response) {
    const { q, limit } = request.query as unknown as { q?: string; limit: number }

    const users = await prisma.user.findMany({
      where: q
        ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ],
        }
        : undefined,
      orderBy: { name: 'asc' },
      take: limit,
      select: userSummarySelect
    })
    return response.status(200).json(users)
  }
}
