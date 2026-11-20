import { Request, Response } from 'express'
import { prisma } from '@/http/lib/prisma'
import { NotFoundError } from '@/http/_errors'
import { userSummarySelect } from '@/http/lib/message-select'

export class GetProfileController {
  public async handle(request: Request, response: Response) {
    const user = await prisma.user.findUnique({
      where: { id: request.user.id },
      select: { ...userSummarySelect, createdAt: true },
    })
    if (!user) throw new NotFoundError('Usuário não encontrado')
    return response.status(200).json(user)
  }
}
