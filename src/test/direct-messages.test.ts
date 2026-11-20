import { describe, expect, it } from 'vitest'
import { api, auth, createUser, sendMessage } from './helpers'

describe('direct messages and search', () => {
  it('opens one DM per pair and reuses it', async () => {
    const ana = await createUser('Ana')
    const bia = await createUser('Bia')

    const first = await api().post('/me/direct-messages').set(auth(ana)).send({ userId: bia.id }).expect(201)
    const again = await api().post('/me/direct-messages').set(auth(bia)).send({ userId: ana.id }).expect(200)
    expect(again.body.slug).toBe(first.body.slug)

    await api().post('/me/direct-messages').set(auth(ana)).send({ userId: ana.id }).expect(400)

    const channels = await api().get('/me/channels').set(auth(bia)).expect(200)
    expect(channels.body[0]).toMatchObject({ type: 'DIRECT', peer: { id: ana.id } })
  })

  it('has no admin features', async () => {
    const ana = await createUser()
    const bia = await createUser()
    const carla = await createUser()
    const { body: dm } = await api().post('/me/direct-messages').set(auth(ana)).send({ userId: bia.id })

    await api().post(`/channels/${dm.slug}/invites`).set(auth(ana)).send({ invitee_id: carla.id }).expect(400)
    await api().put(`/channels/${dm.slug}`).set(auth(ana)).send({ title: 'x' }).expect(400)
    await api().delete(`/channels/${dm.slug}`).set(auth(ana)).expect(400)
    await api().get(`/channels/${dm.slug}/messages`).set(auth(carla)).expect(403)
  })

  it('searches with stemming only in my own channels', async () => {
    const ana = await createUser()
    const bia = await createUser()
    const carla = await createUser()
    const { body: dm } = await api().post('/me/direct-messages').set(auth(ana)).send({ userId: bia.id })
    await sendMessage(ana, dm.slug, 'Precisamos fechar o orçamento do fornecedor')

    const found = await api().get('/me/search').query({ q: 'orçamentos' }).set(auth(bia)).expect(200)
    expect(found.body.results).toHaveLength(1)
    expect(found.body.results[0].snippet).toContain('\u0001orçamento\u0002')
    expect(found.body.results[0].title).toBe(ana.name)

    const hidden = await api().get('/me/search').query({ q: 'orçamento' }).set(auth(carla)).expect(200)
    expect(hidden.body.results).toHaveLength(0)
  })
})
