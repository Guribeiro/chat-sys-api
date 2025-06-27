import { Request, Response } from 'express'
import { prisma } from '@/http/lib/prisma'

import { Role } from '@prisma/client'

export class GetMemberChannelsController {
  public async handle(request: Request, response: Response) {
    const userId = request.user.id

    const { status, role } = request.query as {
      status?: 'active' | 'deactive'
      role?: Role
    }

    const activeFilter =
      status === 'active' ? true : status === 'deactive' ? false : undefined // undefined will skip the filter

    // Prepare the members 'some' condition dynamically
    const memberConditions: { memberId: string; role?: Role } = {
      memberId: userId,
    }

    // Apply role filter only if 'queryRole' is provided
    if (role) {
      memberConditions.role = role
    }

    // Construct the where clause dynamically
    const whereClause: any = {
      members: {
        some: memberConditions,
      },
    }

    // Apply the 'active' filter only if status is 'active' or 'deactive'
    if (activeFilter !== undefined) {
      whereClause.active = activeFilter
    }

    const channels = await prisma.channel.findMany({
      where: whereClause,
      include: {
        _count: {
          select: {
            members: true,
          },
        },
      },
    })


    return response.status(200).json(channels)
  }
}