import { describe, expect, it } from 'vitest'
import { addMember, api, auth, createChannel, createUser, sendMessage } from './helpers'

async function setup() {
  const owner = await createUser('Dona')
  const member = await createUser('Membro')
  const channel = await createChannel(owner)
  await addMember(owner, channel.slug, member)
  return { owner, member, channel }
}

describe('messages', () => {
  it('paginates with a cursor, oldest first inside each page', async () => {
    const { owner, channel } = await setup()
    for (let index = 1; index <= 5; index++) await sendMessage(owner, channel.slug, `msg ${index}`)

    const first = await api().get(`/channels/${channel.slug}/messages?limit=2`).set(auth(owner)).expect(200)
    expect(first.body.messages.map((message: { content: string }) => message.content)).toEqual(['msg 4', 'msg 5'])

    const second = await api().get(`/channels/${channel.slug}/messages?limit=2&cursor=${first.body.nextCursor}`).set(auth(owner))
    expect(second.body.messages.map((message: { content: string }) => message.content)).toEqual(['msg 2', 'msg 3'])

    const last = await api().get(`/channels/${channel.slug}/messages?limit=2&cursor=${second.body.nextCursor}`).set(auth(owner))
    expect(last.body.messages.map((message: { content: string }) => message.content)).toEqual(['msg 1'])
    expect(last.body.nextCursor).toBeNull()
  })

  it('only the author edits; author or admin deletes (soft delete)', async () => {
    const { owner, member, channel } = await setup()
    const message = await sendMessage(member, channel.slug, 'original')

    await api().patch(`/channels/${channel.slug}/messages/${message.id}`).set(auth(owner)).send({ content: 'x' }).expect(403)
    const edited = await api().patch(`/channels/${channel.slug}/messages/${message.id}`).set(auth(member)).send({ content: 'editada' }).expect(200)
    expect(edited.body.editedAt).toBeTruthy()

    await api().delete(`/channels/${channel.slug}/messages/${message.id}`).set(auth(owner)).expect(204)
    const { body } = await api().get(`/channels/${channel.slug}/messages`).set(auth(member))
    expect(body.messages[0]).toMatchObject({ id: message.id, content: null })
    expect(body.messages[0].deletedAt).toBeTruthy()

    await api().patch(`/channels/${channel.slug}/messages/${message.id}`).set(auth(member)).send({ content: 'volta' }).expect(400)
  })

  it('replies must point to a message of the same channel', async () => {
    const { owner, channel } = await setup()
    const other = await createChannel(owner)
    const original = await sendMessage(owner, channel.slug, 'pergunta')

    const reply = await sendMessage(owner, channel.slug, 'resposta', { replyToId: original.id })
    expect(reply.parent).toMatchObject({ id: original.id, content: 'pergunta' })

    await api().post(`/channels/${other.slug}/messages`).set(auth(owner))
      .send({ content: 'x', replyToId: original.id }).expect(400)
  })

  it('stores mentions only for channel members', async () => {
    const { owner, member, channel } = await setup()
    const outsider = await createUser()
    const message = await sendMessage(owner, channel.slug, `oi <@${member.id}> e <@${outsider.id}>`)
    expect(message.mentions.map((mention: { userId: string }) => mention.userId)).toEqual([member.id])
  })

  it('toggles reactions and validates emojis', async () => {
    const { owner, member, channel } = await setup()
    const message = await sendMessage(owner, channel.slug, 'reaja')
    const react = (user: typeof owner, emoji: string) =>
      api().post(`/channels/${channel.slug}/messages/${message.id}/reactions`).set(auth(user)).send({ emoji })

    expect((await react(owner, '👍')).body.reactions).toHaveLength(1)
    expect((await react(member, '👍')).body.reactions).toHaveLength(2)
    expect((await react(owner, '👍')).body.reactions).toHaveLength(1)
    expect((await react(owner, '👨‍👩‍👧')).status).toBe(200)

    for (const invalid of ['abc', '123', '👍 texto']) {
      expect((await react(owner, invalid)).status).toBe(400)
    }
  })

  it('needs text or attachments', async () => {
    const { owner, channel } = await setup()
    await api().post(`/channels/${channel.slug}/messages`).set(auth(owner)).send({}).expect(400)
    await api().post(`/channels/${channel.slug}/messages`).set(auth(owner)).send({ content: '   ' }).expect(400)
  })
})
