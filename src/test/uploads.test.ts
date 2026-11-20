import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { addMember, api, auth, createChannel, createUser } from './helpers'

const png = () => sharp({ create: { width: 64, height: 48, channels: 3, background: '#2a7' } }).png().toBuffer()

describe('attachments and avatars', () => {
  it('uploads an image with thumbnail and sends it in a message', async () => {
    const owner = await createUser()
    const channel = await createChannel(owner)

    const upload = await api().post(`/channels/${channel.slug}/attachments`).set(auth(owner))
      .attach('files', await png(), { filename: 'foto.png', contentType: 'image/png' }).expect(201)
    const [attachment] = upload.body.attachments
    expect(attachment).toMatchObject({ name: 'foto.png', width: 64, height: 48 })
    expect(attachment.thumbnailUrl).toMatch(/^\/uploads\/attachments\//)

    const message = await api().post(`/channels/${channel.slug}/messages`).set(auth(owner))
      .send({ attachmentIds: [attachment.id] }).expect(200)
    expect(message.body.content).toBeNull()
    expect(message.body.attachments).toHaveLength(1)

    // Already used: can not be attached twice
    await api().post(`/channels/${channel.slug}/messages`).set(auth(owner))
      .send({ content: 'de novo', attachmentIds: [attachment.id] }).expect(400)

    await api().get(attachment.url).expect(200).expect('Content-Type', 'image/png')
  })

  it('rejects files that are not what they claim, and forbidden types', async () => {
    const owner = await createUser()
    const channel = await createChannel(owner)
    const send = (buffer: Buffer, filename: string, contentType: string) =>
      api().post(`/channels/${channel.slug}/attachments`).set(auth(owner)).attach('files', buffer, { filename, contentType })

    expect((await send(Buffer.from('not an image'), 'fake.png', 'image/png')).status).toBe(400)
    expect((await send(Buffer.from('<svg onload=alert(1)>'), 'x.svg', 'image/svg+xml')).status).toBe(400)
    expect((await send(Buffer.from('<script>'), 'x.html', 'text/html')).status).toBe(400)
  })

  it('serves documents as downloads and blocks path tricks', async () => {
    const owner = await createUser()
    const channel = await createChannel(owner)
    const upload = await api().post(`/channels/${channel.slug}/attachments`).set(auth(owner))
      .attach('files', Buffer.from('relatório'), { filename: 'notas.txt', contentType: 'text/plain' }).expect(201)

    await api().get(upload.body.attachments[0].url).expect(200).expect('Content-Disposition', 'attachment')
    expect((await api().get('/uploads/..%2f..%2fpackage.json')).status).toBe(403)
  })

  it('members can not attach uploads from other people', async () => {
    const owner = await createUser()
    const member = await createUser()
    const channel = await createChannel(owner)
    await addMember(owner, channel.slug, member)

    const upload = await api().post(`/channels/${channel.slug}/attachments`).set(auth(owner))
      .attach('files', await png(), { filename: 'foto.png', contentType: 'image/png' }).expect(201)
    await api().post(`/channels/${channel.slug}/messages`).set(auth(member))
      .send({ attachmentIds: [upload.body.attachments[0].id] }).expect(400)
  })

  it('stores avatars as 256px webp and can remove them', async () => {
    const user = await createUser()
    const { body } = await api().put('/me/avatar').set(auth(user))
      .attach('avatar', await png(), { filename: 'eu.png', contentType: 'image/png' }).expect(200)
    expect(body.avatarUrl).toMatch(/\.webp$/)

    const file = await api().get(body.avatarUrl).buffer(true).parse((response, callback) => {
      const chunks: Buffer[] = []
      response.on('data', (chunk: Buffer) => chunks.push(chunk))
      response.on('end', () => callback(null, Buffer.concat(chunks)))
    })
    const metadata = await sharp(file.body as Buffer).metadata()
    expect(metadata).toMatchObject({ format: 'webp', width: 256, height: 256 })

    const removed = await api().delete('/me/avatar').set(auth(user)).expect(200)
    expect(removed.body.avatarUrl).toBeNull()
  })
})
