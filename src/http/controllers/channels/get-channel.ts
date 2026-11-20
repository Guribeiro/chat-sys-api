import { Request, Response } from 'express'
import { getMembership } from '@/http/lib/get-membership'

export class GetChannelController {
  public async handle(request: Request, response: Response): Promise<Response> {
    const { slug } = request.params
    const { channel } = await getMembership(slug, request.user.id)

    return response.status(200).json(channel)
  }
}
