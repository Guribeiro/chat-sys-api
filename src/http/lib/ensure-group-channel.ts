import type { Channel } from '@prisma/client'
import { BadRequestError } from '@/http/_errors'

/** Direct messages have no admin features (rename, invites, removal, status, deletion). */
export function ensureGroupChannel(channel: Channel) {
  if (channel.type === 'DIRECT') {
    throw new BadRequestError('This action is not available for direct messages')
  }
}
