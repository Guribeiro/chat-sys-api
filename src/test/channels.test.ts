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

describe('channel roles and ownership', () => {
  async function setup() {
    const owner = await createUser()
    const admin = await createUser()
    const member = await createUser()
    const channel = await createChannel(owner)
    await addMember(owner, channel.slug, admin, 'ADMIN')
    await addMember(owner, channel.slug, member)
    const { body: members } = await api().get(`/channels/${channel.slug}/members`).set(auth(owner)).expect(200)
    const rowOf = (user: { id: string }) => members.find((row: { memberId: string }) => row.memberId === user.id).id as string
    return { owner, admin, member, channel, members, rowOf }
  }

  it('tells the viewer what they may do and who owns the channel', async () => {
    const { owner, admin, member, channel, members } = await setup()

    const asOwner = await api().get(`/channels/${channel.slug}`).set(auth(owner)).expect(200)
    expect(asOwner.body).toMatchObject({ ownerId: owner.id, viewer: { role: 'ADMIN', isOwner: true, isAdmin: true } })
    const asAdmin = await api().get(`/channels/${channel.slug}`).set(auth(admin)).expect(200)
    expect(asAdmin.body.viewer).toEqual({ role: 'ADMIN', isOwner: false, isAdmin: true })
    const asMember = await api().get(`/channels/${channel.slug}`).set(auth(member)).expect(200)
    expect(asMember.body.viewer).toEqual({ role: 'MEMBER', isOwner: false, isAdmin: false })

    expect(members.filter((row: { isOwner: boolean }) => row.isOwner).map((row: { memberId: string }) => row.memberId)).toEqual([owner.id])
  })

  it('admins promote members, only the owner demotes admins, nobody changes the owner or themselves', async () => {
    const { owner, admin, member, channel, rowOf } = await setup()
    const path = (user: { id: string }) => `/channels/${channel.slug}/members/${rowOf(user)}`

    await api().patch(path(admin)).set(auth(member)).send({ role: 'MEMBER' }).expect(403)
    const promoted = await api().patch(path(member)).set(auth(admin)).send({ role: 'ADMIN' }).expect(200)
    expect(promoted.body.role).toBe('ADMIN')

    await api().patch(path(member)).set(auth(admin)).send({ role: 'MEMBER' }).expect(403)
    await api().patch(path(admin)).set(auth(admin)).send({ role: 'MEMBER' }).expect(400)
    await api().patch(path(owner)).set(auth(admin)).send({ role: 'MEMBER' }).expect(400)
    await api().patch(path(owner)).set(auth(owner)).send({ role: 'MEMBER' }).expect(400)

    const demoted = await api().patch(path(member)).set(auth(owner)).send({ role: 'MEMBER' }).expect(200)
    expect(demoted.body.role).toBe('MEMBER')
  })

  it('only the owner transfers ownership, and the new owner can then delete the channel', async () => {
    const { owner, admin, member, channel, rowOf } = await setup()
    const transfer = (by: Parameters<typeof auth>[0], to: { id: string }) =>
      api().post(`/channels/${channel.slug}/transfer-ownership`).set(auth(by)).send({ memberId: rowOf(to) })

    await transfer(admin, member).expect(403)
    await transfer(owner, owner).expect(400)
    await transfer(owner, member).expect(204)

    const { body } = await api().get(`/channels/${channel.slug}`).set(auth(member)).expect(200)
    expect(body).toMatchObject({ ownerId: member.id, viewer: { role: 'ADMIN', isOwner: true } })
    const previous = await api().get(`/channels/${channel.slug}`).set(auth(owner)).expect(200)
    expect(previous.body.viewer).toEqual({ role: 'ADMIN', isOwner: false, isAdmin: true })

    await api().delete(`/channels/${channel.slug}`).set(auth(owner)).expect(403)
    await api().delete(`/channels/${channel.slug}`).set(auth(member)).expect(204)
  })

  it('lists pending invites with the invitee and lets an admin revoke them', async () => {
    const owner = await createUser()
    const invitee = await createUser()
    const channel = await createChannel(owner)
    await api().post(`/channels/${channel.slug}/invites`).set(auth(owner)).send({ invitee_id: invitee.id }).expect(201)

    const { body } = await api().get(`/channels/${channel.slug}/invites`).set(auth(owner)).expect(200)
    expect(body[0]).toMatchObject({ invitee: { id: invitee.id }, author: { id: owner.id } })

    await api().delete(`/channels/${channel.slug}/invites/${body[0].id}`).set(auth(owner)).expect(204)
    const after = await api().get(`/channels/${channel.slug}/invites`).set(auth(owner)).expect(200)
    expect(after.body).toHaveLength(0)
  })

  it('an inactive channel rejects new messages until it is reactivated', async () => {
    const { owner, member, channel } = await setup()
    await api().patch(`/channels/${channel.slug}/active`).set(auth(owner)).send({ status: 'INATIVO' }).expect(200)

    const rejected = await api().post(`/channels/${channel.slug}/messages`).set(auth(member)).send({ content: 'oi' }).expect(403)
    expect(rejected.body.message).toBe('Este canal está inativo')

    await api().patch(`/channels/${channel.slug}/active`).set(auth(owner)).send({ status: 'ATIVO' }).expect(200)
    await sendMessage(member, channel.slug, 'voltou')
  })
})
