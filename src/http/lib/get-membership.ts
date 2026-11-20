import type { Channel, Member } from '@prisma/client'

import { prisma } from '@/http/lib/prisma'
import { ForbiddenError, NotFoundError } from '@/http/_errors'

export type Membership = {
  channel: Channel
  member: Member
  isOwner: boolean
  isAdmin: boolean
}

/**
 * Resolves the channel by slug and the current user's membership in it.
 * Throws NotFoundError if the channel does not exist and ForbiddenError if the user is not a member.
 */
export async function getMembership(slug: string, userId: string): Promise<Membership> {
  const channel = await prisma.channel.findUnique({ where: { slug } })

  if (!channel) {
    throw new NotFoundError('Channel not found')
  }

  const member = await prisma.member.findUnique({
    where: { channelId_memberId: { channelId: channel.id, memberId: userId } },
  })

  if (!member) {
    throw new ForbiddenError('You are not a member of this channel')
  }

  const isOwner = channel.ownerId === userId

  return { channel, member, isOwner, isAdmin: isOwner || member.role === 'ADMIN' }
}

/** Same as getMembership, but also requires the user to be the owner or an ADMIN of the channel. */
export async function getAdminMembership(slug: string, userId: string): Promise<Membership> {
  const membership = await getMembership(slug, userId)

  if (!membership.isAdmin) {
    throw new ForbiddenError('You are not allowed to manage this channel')
  }

  return membership
}
