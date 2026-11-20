import { Request, Response } from 'express'
import { getMembership } from '@/http/lib/get-membership'

export class GetChannelController {
  public async handle(request: Request, response: Response): Promise<Response> {
    const { slug } = request.params
    const { channel, member, isOwner, isAdmin } = await getMembership(slug, request.user.id)

    // `viewer` tells the client what the current user may do here, so it never has to guess
    return response.status(200).json({
      ...channel,
      viewer: { role: member.role, isOwner, isAdmin },
    })
  }
}
