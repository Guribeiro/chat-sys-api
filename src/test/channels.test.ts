import { describe, expect, it } from 'vitest'
import { addMember, api, auth, createChannel, createUser, sendMessage } from './helpers'

describe('channel access', () => {
  it('only members can read a channel and its messages', async () => {
    const owner = await createUser()
    const outsider = await createUser()
    const channel = await createChannel(owner)

    await api().get(`/channels/${channel.slug}`).set(auth(outsider)).expect(403)
    await api().get(`/channels/${channel.slug}/messages`).set(auth(outsider)).expect(403)
    await api().get(`/channels/${channel.slug}/members`).set(auth(outsider)).expect(403)
    await api().post(`/channels/${channel.slug}/messages`).set(auth(outsider)).send({ content: 'oi' }).expect(403)
    await api().get(`/channels/${channel.slug}/messages`).set(auth(owner)).expect(200)
  })

  it('allows several pending invites in the same channel', async () => {
    const owner = await createUser()
    const [a, b] = await Promise.all([createUser(), createUser()])
    const channel = await createChannel(owner)

    for (const invitee of [a, b]) {
      await api().post(`/channels/${channel.slug}/invites`).set(auth(owner)).send({ invitee_id: invitee.id }).expect(201)
    }
    const { body } = await api().get(`/channels/${channel.slug}/invites`).set(auth(owner)).expect(200)
    expect(body).toHaveLength(2)
    expect(body.every((invite: { role: string }) => invite.role === 'MEMBER')).toBe(true)
  })

  it('regular members can not manage the channel', async () => {
    const owner = await createUser()
    const member = await createUser()
    const other = await createUser()
    const channel = await createChannel(owner)
    await addMember(owner, channel.slug, member)

    await api().post(`/channels/${channel.slug}/invites`).set(auth(member)).send({ invitee_id: other.id }).expect(403)
    await api().put(`/channels/${channel.slug}`).set(auth(member)).send({ title: 'novo' }).expect(403)
    await api().patch(`/channels/${channel.slug}/active`).set(auth(member)).send({ status: 'INATIVO' }).expect(403)
    await api().delete(`/channels/${channel.slug}`).set(auth(member)).expect(403)
  })

  it('admins manage members but only the owner deletes the channel or removes admins', async () => {
    const owner = await createUser()
    const admin = await createUser()
    const admin2 = await createUser()
    const member = await createUser()
    const channel = await createChannel(owner)
    await addMember(owner, channel.slug, admin, 'ADMIN')
    await addMember(owner, channel.slug, admin2, 'ADMIN')
    await addMember(owner, channel.slug, member)

    const { body: members } = await api().get(`/channels/${channel.slug}/members`).set(auth(owner)).expect(200)
    const rowOf = (user: { id: string }) => members.find((row: { memberId: string }) => row.memberId === user.id).id

    await api().delete(`/channels/${channel.slug}/members/${rowOf(admin2)}`).set(auth(admin)).expect(403)
    await api().delete(`/channels/${channel.slug}/members/${rowOf(owner)}`).set(auth(admin)).expect(400)
    await api().delete(`/channels/${channel.slug}/members/${rowOf(member)}`).set(auth(admin)).expect(204)
    await api().delete(`/channels/${channel.slug}`).set(auth(admin)).expect(403)
    await api().delete(`/channels/${channel.slug}`).set(auth(owner)).expect(204)
  })

  it('refuses a second channel with the same title', async () => {
    const owner = await createUser()
    await createChannel(owner, 'Financeiro')
    await api().post('/channels').set(auth(owner)).send({ title: 'Financeiro' }).expect(400)
  })

  it('counts unread messages until the channel is read', async () => {
    const owner = await createUser()
    const member = await createUser()
    const channel = await createChannel(owner)
    await addMember(owner, channel.slug, member)

    await sendMessage(owner, channel.slug, 'um')
    await sendMessage(owner, channel.slug, 'dois')
    const unread = async () =>
      (await api().get('/me/channels').set(auth(member))).body.find((item: { id: string }) => item.id === channel.id).unreadCount

    expect(await unread()).toBe(2)
    await api().post(`/channels/${channel.slug}/read`).set(auth(member)).expect(204)
    expect(await unread()).toBe(0)
  })
})
