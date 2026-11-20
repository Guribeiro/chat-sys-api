import request from 'supertest'
import { app } from '@/app'

export const api = () => request(app)

let counter = 0

export type TestUser = { id: string; name: string; email: string; token: string; refreshToken: string }

export async function createUser(name = `User ${++counter}`): Promise<TestUser> {
  const email = `${name.toLowerCase().replace(/\W+/g, '.')}.${Date.now()}.${++counter}@test.dev`
  await api().post('/sessions/account').send({ name, email, password: '123456' }).expect(204)
  const { body } = await api().post('/sessions/password').send({ email, password: '123456' }).expect(200)
  return { ...body.user, token: body.token, refreshToken: body.refreshToken }
}

export const auth = (user: TestUser) => ({ Authorization: `Bearer ${user.token}` })

export async function createChannel(owner: TestUser, title = `Canal ${++counter}`) {
  const { body } = await api().post('/channels').set(auth(owner)).send({ title }).expect(200)
  return body as { id: string; slug: string; title: string }
}

/** Invites and accepts, so the user becomes a member with the given role. */
export async function addMember(owner: TestUser, slug: string, user: TestUser, role: 'ADMIN' | 'MEMBER' = 'MEMBER') {
  const { body } = await api().post(`/channels/${slug}/invites`).set(auth(owner)).send({ invitee_id: user.id, role }).expect(201)
  await api().post(`/me/invites/${body.inviteId}/accept`).set(auth(user)).expect(204)
}

export async function sendMessage(user: TestUser, slug: string, content: string, extra: object = {}) {
  const { body } = await api().post(`/channels/${slug}/messages`).set(auth(user)).send({ content, ...extra }).expect(200)
  return body
}
