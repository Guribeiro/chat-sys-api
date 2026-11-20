import type { Channel } from '@prisma/client'
import { BadRequestError, ForbiddenError } from '@/http/_errors'

/** Direct messages have no admin features (rename, invites, removal, status, deletion). */
export function ensureGroupChannel(channel: Channel) {
  if (channel.type === 'DIRECT') {
    throw new BadRequestError('Esta ação não está disponível em mensagens diretas')
  }
}

/** An inactive channel is read-only: nobody posts or uploads until an admin reactivates it. */
export function ensureActiveChannel(channel: Channel) {
  if (!channel.active) {
    throw new ForbiddenError('Este canal está inativo')
  }
}
