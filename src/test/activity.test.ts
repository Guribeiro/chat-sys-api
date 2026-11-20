import { describe, expect, it } from 'vitest'
import { addMember, api, auth, createChannel, createUser, sendMessage, type TestUser } from './helpers'

async function setup() {
  const owner = await createUser('Dona')
  const member = await createUser('Membro')
  const channel = await createChannel(owner)
  await addMember(owner, channel.slug, member)
  return { owner, member, channel }
}

type ActivityItem = { reason: 'mention' | 'reply'; unread: boolean; channel: { slug: string }; message: { id: string; content: string } }

const activity = async (user: TestUser, query = '') =>
  (await api().get(`/me/activity${query}`).set(auth(user)).expect(200)).body as {
    items: ActivityItem[]
    nextCursor: string | null
    unreadCount: number
  }

describe('activity', () => {
  it('lists mentions of me and replies to my messages, newest first', async () => {
    const { owner, member, channel } = await setup()
    const mine = await sendMessage(member, channel.slug, 'minha pergunta')
    await sendMessage(owner, channel.slug, 'mensagem comum')
    const reply = await sendMessage(owner, channel.slug, 'resposta', { replyToId: mine.id })
    const mention = await sendMessage(owner, channel.slug, `oi <@${member.id}>`)

    const { items, unreadCount } = await activity(member)
    expect(items.map((item) => [item.reason, item.message.id])).toEqual([
      ['mention', mention.id],
      ['reply', reply.id],
    ])
    expect(items[0].channel.slug).toBe(channel.slug)
    expect(unreadCount).toBe(2)
  })

  it('does not duplicate a reply that also mentions me', async () => {
    const { owner, member, channel } = await setup()
    const mine = await sendMessage(member, channel.slug, 'pergunta')
    const both = await sendMessage(owner, channel.slug, `<@${member.id}> resposta`, { replyToId: mine.id })

    const { items } = await activity(member)
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ reason: 'mention', message: { id: both.id } })
  })

  it('ignores my own messages, deleted messages and channels I left', async () => {
    const { owner, member, channel } = await setup()
    const mine = await sendMessage(member, channel.slug, 'pergunta')
    await sendMessage(member, channel.slug, `eu mesmo <@${member.id}>`, { replyToId: mine.id })
    const deleted = await sendMessage(owner, channel.slug, `<@${member.id}> apagada`)
    await api().delete(`/channels/${channel.slug}/messages/${deleted.id}`).set(auth(owner)).expect(204)
    expect((await activity(member)).items).toHaveLength(0)

    await sendMessage(owner, channel.slug, `<@${member.id}> antes de sair`)
    expect((await activity(member)).items).toHaveLength(1)

    const { body: members } = await api().get(`/channels/${channel.slug}/members`).set(auth(owner)).expect(200)
    const row = members.find((item: { memberId: string }) => item.memberId === member.id)
    await api().delete(`/channels/${channel.slug}/members/${row.id}`).set(auth(owner)).expect(204)
    expect((await activity(member)).items).toHaveLength(0)
  })

  it('paginates with a cursor and resets the unread count once seen', async () => {
    const { owner, member, channel } = await setup()
    for (let index = 1; index <= 3; index++) await sendMessage(owner, channel.slug, `<@${member.id}> ${index}`)

    const first = await activity(member, '?limit=2')
    expect(first.items).toHaveLength(2)
    expect(first.nextCursor).toBeTruthy()
    const second = await activity(member, `?limit=2&cursor=${first.nextCursor}`)
    expect(second.items).toHaveLength(1)
    expect(second.nextCursor).toBeNull()
    expect(new Set([...first.items, ...second.items].map((item) => item.message.id)).size).toBe(3)

    await api().post('/me/activity/seen').set(auth(member)).expect(204)
    const seen = await activity(member)
    expect(seen.unreadCount).toBe(0)
    expect(seen.items.every((item) => !item.unread)).toBe(true)

    await sendMessage(owner, channel.slug, `<@${member.id}> nova`)
    expect((await activity(member)).unreadCount).toBe(1)
  })
})

describe('channel notifications', () => {
  const channelOf = async (user: TestUser, id: string) =>
    (await api().get('/me/channels').set(auth(user)).expect(200)).body.find((item: { id: string }) => item.id === id)

  it('mutes a channel only for the member who asked', async () => {
    const { owner, member, channel } = await setup()
    const outsider = await createUser()

    await api().patch(`/channels/${channel.slug}/notifications`).set(auth(outsider)).send({ muted: true }).expect(403)
    await api().patch(`/channels/${channel.slug}/notifications`).set(auth(member)).send({ muted: 'sim' }).expect(400)
    await api().patch(`/channels/${channel.slug}/notifications`).set(auth(member)).send({ muted: true }).expect(200)

    expect((await channelOf(member, channel.id)).muted).toBe(true)
    expect((await channelOf(owner, channel.id)).muted).toBe(false)

    await api().patch(`/channels/${channel.slug}/notifications`).set(auth(member)).send({ muted: false }).expect(200)
    expect((await channelOf(member, channel.id)).muted).toBe(false)
  })

  it('counts unread messages addressed to me separately', async () => {
    const { owner, member, channel } = await setup()
    const mine = await sendMessage(member, channel.slug, 'pergunta')
    await sendMessage(owner, channel.slug, 'comum')
    await sendMessage(owner, channel.slug, 'resposta', { replyToId: mine.id })
    await sendMessage(owner, channel.slug, `<@${member.id}> menção`)

    expect(await channelOf(member, channel.id)).toMatchObject({ unreadCount: 3, unreadMentionCount: 2 })
    // Posting marks the channel as read for the sender
    expect(await channelOf(owner, channel.id)).toMatchObject({ unreadCount: 0, unreadMentionCount: 0 })

    await api().post(`/channels/${channel.slug}/read`).set(auth(member)).expect(204)
    expect(await channelOf(member, channel.id)).toMatchObject({ unreadCount: 0, unreadMentionCount: 0 })
  })
})
