import { describe, expect, it } from 'vitest'
import { prisma } from '@/http/lib/prisma'
import { api, auth, createUser } from './helpers'

describe('auth', () => {
  it('rejects invalid bodies with 400 and field errors', async () => {
    const { body } = await api().post('/sessions/password').send({ email: 'x' }).expect(400)
    expect(body.errors).toHaveProperty('email')
    expect(body.errors).toHaveProperty('password')
  })

  it('does not reveal whether an e-mail exists on login', async () => {
    const user = await createUser()
    const wrongPassword = await api().post('/sessions/password').send({ email: user.email, password: 'errada' })
    const unknownEmail = await api().post('/sessions/password').send({ email: 'ninguem@test.dev', password: 'errada' })
    expect(wrongPassword.status).toBe(400)
    expect(unknownEmail.body).toEqual(wrongPassword.body)
  })

  it('rotates refresh tokens and refuses a reused one', async () => {
    const user = await createUser()
    const first = await api().post('/sessions/refresh').send({ refreshToken: user.refreshToken }).expect(200)
    expect(first.body.token).toBeTruthy()
    expect(first.body.refreshToken).not.toBe(user.refreshToken)

    await api().post('/sessions/refresh').send({ refreshToken: user.refreshToken }).expect(401)
    await api().post('/sessions/refresh').send({ refreshToken: first.body.refreshToken }).expect(200)
  })

  it('logout revokes the refresh token', async () => {
    const user = await createUser()
    await api().post('/sessions/logout').send({ refreshToken: user.refreshToken }).expect(204)
    await api().post('/sessions/refresh').send({ refreshToken: user.refreshToken }).expect(401)
  })

  it('password reset codes are single use and end every session', async () => {
    const user = await createUser()
    await api().post('/sessions/password/recover').send({ email: user.email }).expect(201)
    const token = await prisma.token.findFirstOrThrow({ where: { userId: user.id, type: 'PASSWORD_RECOVER' } })
    expect(token.expiresAt!.getTime()).toBeGreaterThan(Date.now())

    await api().post('/sessions/password/reset').send({ code: token.id, password: 'nova-senha' }).expect(201)
    await api().post('/sessions/password/reset').send({ code: token.id, password: 'outra-senha' }).expect(400)
    await api().post('/sessions/refresh').send({ refreshToken: user.refreshToken }).expect(401)
    await api().post('/sessions/password').send({ email: user.email, password: 'nova-senha' }).expect(200)
  })

  it('rejects expired password reset codes', async () => {
    const user = await createUser()
    const token = await prisma.token.create({
      data: { userId: user.id, type: 'PASSWORD_RECOVER', expiresAt: new Date(Date.now() - 1000) },
    })
    await api().post('/sessions/password/reset').send({ code: token.id, password: 'nova-senha' }).expect(400)
  })

  it('requires a bearer token on protected routes', async () => {
    await api().get('/me/channels').expect(401)
    await api().get('/me/channels').set({ Authorization: 'Bearer invalido' }).expect(401)
    const user = await createUser()
    await api().get('/me/channels').set(auth(user)).expect(200)
  })

  it('changing the password keeps only the current session', async () => {
    const user = await createUser()
    const otherDevice = await api().post('/sessions/password').send({ email: user.email, password: '123456' }).expect(200)

    await api().patch('/me/password').set(auth(user))
      .send({ currentPassword: 'errada', newPassword: '654321' }).expect(400)
    await api().patch('/me/password').set(auth(user))
      .send({ currentPassword: '123456', newPassword: '654321', refreshToken: user.refreshToken }).expect(204)

    await api().post('/sessions/refresh').send({ refreshToken: otherDevice.body.refreshToken }).expect(401)
    await api().post('/sessions/refresh').send({ refreshToken: user.refreshToken }).expect(200)
  })
})
