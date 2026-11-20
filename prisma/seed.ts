import { faker } from '@faker-js/faker/locale/pt_BR'
import { PrismaClient, type Role } from '@prisma/client'
import { hash } from 'bcryptjs'
import { createSlug } from '@/utils/create-slug'

const prisma = new PrismaClient()

// Deterministic: every run produces the same users, channels and conversations
faker.seed(42)

const PASSWORD = '123456'
const DAY = 24 * 60 * 60 * 1000
const NOW = Date.now()

// ---------------------------------------------------------------------------------------------
// Conversation building blocks (pt-BR), mixed at random to produce believable chat traffic
// ---------------------------------------------------------------------------------------------
const GREETINGS = [
  'Bom dia, pessoal!', 'Boa tarde!', 'E aí, tudo certo?', 'Opa, cheguei', 'Bom dia! ☕',
  'Fala, time!', 'Alguém online?', 'Voltei do almoço',
]

const QUESTIONS = [
  'Alguém sabe se a reunião de hoje ainda está de pé?',
  'Quem pode revisar meu PR rapidinho?',
  'Onde fica a documentação do processo novo?',
  'Vocês viram o e-mail da diretoria?',
  'Qual o prazo final pra essa entrega?',
  'Alguém mais está com o sistema lento?',
  'Dá pra gente marcar uma call amanhã às 10h?',
  'Esse ticket está com quem agora?',
  'Tem alguma atualização sobre o fornecedor?',
  'Alguém tem o link da planilha de acompanhamento?',
  'Como ficou a decisão sobre o orçamento?',
  'Posso subir isso hoje ou esperamos segunda?',
]

const ANSWERS = [
  'Sim, confirmado!', 'Vou verificar e já te falo', 'Pode deixar comigo', 'Acho que não, mas confirmo',
  'Já está resolvido 👍', 'Te mando por DM', 'Ainda não, estou aguardando retorno',
  'Combinado!', 'Faz sentido', 'Boa ideia', 'Concordo totalmente', 'Valeu!', 'Perfeito, obrigado',
  'Hmm, não tinha visto isso', 'Estou olhando agora', 'Daqui a pouco consigo ver',
  'Isso mesmo', 'Show!', 'kkkkk', 'Pode ser, por mim ok',
]

const UPDATES = [
  'Acabei de subir a nova versão em homologação.',
  'Atualizei a planilha com os números da semana.',
  'Reunião remarcada para quinta às 15h.',
  'O cliente aprovou a proposta! 🎉',
  'Fechei os tickets pendentes de ontem.',
  'Lembrete: amanhã é o prazo para enviar os relatórios.',
  'Deploy concluído sem erros.',
  'Mandei o resumo da reunião por e-mail.',
  'O fornecedor confirmou a entrega para a próxima semana.',
  'Vou ficar fora à tarde, qualquer coisa me chamem no celular.',
]

const LONG_MESSAGES = [
  'Pessoal, fiz um levantamento rápido dos pontos que discutimos:\n\n1. Revisar o fluxo de aprovação\n2. Atualizar a documentação\n3. Agendar o treinamento com o time novo\n\nSe alguém quiser complementar, fiquem à vontade.',
  'Só pra registrar o que combinamos na call: a gente segue com a opção B por enquanto, e se os números do mês que vem não melhorarem revisitamos a decisão. Qualquer dúvida me chamem.',
  'Resumo da semana:\n- Entregas concluídas: 8\n- Em andamento: 3\n- Bloqueadas: 1 (aguardando acesso)\n\nBom fim de semana a todos!',
  'Encontrei a causa do problema: era uma configuração antiga que ficou no ambiente de produção depois da migração. Já corrigi e documentei no wiki pra não acontecer de novo.',
]

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '🎉', '🙏', '👀', '✅', '🔥']

// A few messages use Markdown, so the renderer has something to show
const MARKDOWN_MESSAGES = [
  'Checklist do deploy:\n- [x] testes passando\n- [x] changelog atualizado\n- [ ] avisar o suporte',
  'Comando pra rodar localmente: `pnpm docker:up` e depois `pnpm docker:seed`',
  '**Importante:** a janela de manutenção é sábado das 22h às 2h.',
  'Documentação aqui: https://example.com/docs/processo-novo',
  '> O cliente pediu prioridade máxima nisso\n\nVamos alinhar na daily de amanhã.',
  '```\nERROR: connection timeout after 30s\n```\nAlguém já viu esse erro?',
  'Resumo: _aprovado_ pela diretoria, falta só ~~orçamento~~ a assinatura do contrato.',
]

function chatLine(): string {
  const roll = faker.number.float()
  if (roll < 0.08) return faker.helpers.arrayElement(GREETINGS)
  if (roll < 0.33) return faker.helpers.arrayElement(QUESTIONS)
  if (roll < 0.73) return faker.helpers.arrayElement(ANSWERS)
  if (roll < 0.93) return faker.helpers.arrayElement(UPDATES)
  if (roll < 0.96) return faker.helpers.arrayElement(LONG_MESSAGES)
  if (roll < 0.985) return faker.helpers.arrayElement(MARKDOWN_MESSAGES)
  return faker.lorem.sentence({ min: 6, max: 14 })
}

// ---------------------------------------------------------------------------------------------
// Seed definition
// ---------------------------------------------------------------------------------------------
type UserKey = string

type ChannelSeed = {
  title: string
  description: string
  owner: UserKey
  members: UserKey[]
  admins?: UserKey[]
  messages: number
  /** Spread of the conversation, in days back from now */
  days: number
  active?: boolean
  /** Pending invites: invitee -> role */
  invites?: { invitee: UserKey; author?: UserKey; role: Role }[]
  /** How many of the latest messages each user has NOT read yet (creates unread badges) */
  unread?: Record<UserKey, number>
}

async function seed() {
  await prisma.attachment.deleteMany()
  await prisma.reaction.deleteMany()
  await prisma.mention.deleteMany()
  await prisma.member.deleteMany()
  await prisma.invite.deleteMany()
  await prisma.message.deleteMany()
  await prisma.channel.deleteMany()
  await prisma.token.deleteMany()
  await prisma.user.deleteMany()

  const passwordHash = await hash(PASSWORD, 1)

  // ---- Users ------------------------------------------------------------------------------
  const fixedUsers = [
    { key: 'gustavo', name: 'Gustavo', email: 'gustavo@gmail.com' },
    { key: 'gabriel', name: 'Gabriel', email: 'gabriel@gmail.com' },
  ]

  const extraUsers = Array.from({ length: 10 }, (_, index) => {
    const firstName = faker.person.firstName()
    const lastName = faker.person.lastName()
    return {
      key: `user${index + 1}`,
      name: `${firstName} ${lastName}`,
      email: faker.internet.email({ firstName, lastName, provider: 'example.com' }).toLowerCase(),
    }
  })

  const users = new Map<UserKey, { id: string; name: string | null; email: string }>()
  for (const { key, name, email } of [...fixedUsers, ...extraUsers]) {
    const user = await prisma.user.create({ data: { name, email, password: passwordHash } })
    users.set(key, user)
  }

  const everyone = [...users.keys()]
  const id = (key: UserKey) => {
    const user = users.get(key)
    if (!user) throw new Error(`Unknown seed user: ${key}`)
    return user.id
  }

  // ---- Channels ---------------------------------------------------------------------------
  const channels: ChannelSeed[] = [
    {
      title: 'Geral',
      description: 'Avisos e conversas para toda a empresa',
      owner: 'gustavo',
      members: everyone,
      admins: ['gabriel'],
      messages: 320,
      days: 30,
      unread: { gustavo: 12, gabriel: 40 },
    },
    {
      title: 'TI',
      description: 'Suporte, infraestrutura e desenvolvimento',
      owner: 'gustavo',
      members: ['gustavo', 'user1', 'user2', 'user3', 'user4'],
      admins: ['user1'],
      messages: 180,
      days: 20,
      invites: [{ invitee: 'gabriel', role: 'MEMBER' }],
      unread: { gustavo: 5 },
    },
    {
      title: 'Recursos Humanos',
      description: 'Benefícios, férias e processos internos',
      owner: 'gabriel',
      members: ['gabriel', 'user5', 'user6'],
      messages: 60,
      days: 15,
      invites: [{ invitee: 'gustavo', role: 'MEMBER' }],
    },
    {
      title: 'Financeiro',
      description: 'Orçamento, notas fiscais e reembolsos',
      owner: 'gabriel',
      members: ['gabriel', 'gustavo', 'user6', 'user7'],
      messages: 95,
      days: 25,
      unread: { gustavo: 3 },
    },
    {
      title: 'Marketing',
      description: 'Campanhas, redes sociais e eventos',
      owner: 'user8',
      members: ['user8', 'gustavo', 'gabriel', 'user9', 'user10'],
      admins: ['user9'],
      messages: 45,
      days: 10,
    },
    {
      title: 'Projeto Atlas',
      description: 'Squad do novo produto — dailies e decisões',
      owner: 'gustavo',
      members: ['gustavo', 'gabriel', 'user1', 'user3', 'user8'],
      admins: ['gabriel'],
      messages: 140,
      days: 7,
      unread: { gustavo: 25, gabriel: 8 },
    },
    {
      title: 'Café e Conversa',
      description: 'Off-topic, memes e indicações',
      owner: 'user2',
      members: everyone,
      messages: 75,
      days: 12,
    },
    {
      title: 'Novidades',
      description: 'Canal recém-criado, ainda sem mensagens',
      owner: 'gustavo',
      members: ['gustavo', 'gabriel'],
      messages: 0,
      days: 1,
    },
    {
      title: 'Projeto Legado',
      description: 'Canal arquivado do projeto antigo',
      owner: 'gustavo',
      members: ['gustavo', 'user1', 'user4'],
      messages: 30,
      days: 60,
      active: false,
    },
    {
      title: 'Vendas',
      description: 'Pipeline, metas e clientes',
      owner: 'user7',
      members: ['user7', 'user9', 'user10'],
      messages: 50,
      days: 14,
      invites: [
        { invitee: 'gustavo', role: 'ADMIN' },
        { invitee: 'gabriel', role: 'MEMBER' },
      ],
    },
  ]

  let totalMessages = 0
  const totals = { replies: 0, mentions: 0, reactions: 0 }

  for (const definition of channels) {
    const memberKeys = Array.from(new Set([definition.owner, ...definition.members]))

    const channel = await prisma.channel.create({
      data: {
        title: definition.title,
        slug: createSlug(definition.title),
        description: definition.description,
        active: definition.active ?? true,
        ownerId: id(definition.owner),
        createdAt: new Date(NOW - (definition.days + 1) * DAY),
      },
    })

    // ---- Messages: chronological, in bursts, authored by channel members --------------
    const start = NOW - definition.days * DAY
    const step = (definition.days * DAY) / Math.max(definition.messages, 1)
    let cursor = start
    let lastAuthor: UserKey | null = null

    const messages = Array.from({ length: definition.messages }, () => {
      // Mostly short gaps (a live conversation), sometimes long pauses (next day)
      cursor += faker.number.float() < 0.85
        ? faker.number.int({ min: 10_000, max: Math.max(20_000, step * 0.6) })
        : faker.number.int({ min: step, max: step * 3 })
      cursor = Math.min(cursor, NOW - 60_000)

      // People often send a couple of messages in a row
      const author: UserKey = lastAuthor && faker.number.float() < 0.3
        ? lastAuthor
        : faker.helpers.arrayElement(memberKeys)
      lastAuthor = author

      const createdAt = new Date(cursor)
      const roll = faker.number.float()
      const deleted = roll < 0.03
      const edited = !deleted && roll < 0.1

      return {
        id: faker.string.uuid(),
        parentId: null as string | null,
        channelId: channel.id,
        authorId: id(author),
        content: deleted ? null : chatLine(),
        createdAt,
        editedAt: edited ? new Date(createdAt.getTime() + faker.number.int({ min: 30_000, max: 600_000 })) : null,
        deletedAt: deleted ? new Date(createdAt.getTime() + faker.number.int({ min: 30_000, max: 600_000 })) : null,
      }
    })

    messages.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())

    // Stretch the timeline so the conversation spans the whole period and ends minutes ago
    const lastRaw = messages.at(-1)?.createdAt.getTime() ?? start
    const end = NOW - faker.number.int({ min: 2, max: 90 }) * 60_000
    const scale = lastRaw > start ? (end - start) / (lastRaw - start) : 1
    for (const message of messages) {
      const shift = message.createdAt.getTime()
      const stretched = start + (shift - start) * scale
      const delta = stretched - shift
      message.createdAt = new Date(stretched)
      if (message.editedAt) message.editedAt = new Date(message.editedAt.getTime() + delta)
      if (message.deletedAt) message.deletedAt = new Date(message.deletedAt.getTime() + delta)
    }

    // Same timestamp twice would make the order ambiguous: nudge duplicates forward
    for (let index = 1; index < messages.length; index++) {
      if (messages[index].createdAt <= messages[index - 1].createdAt) {
        messages[index].createdAt = new Date(messages[index - 1].createdAt.getTime() + 1000)
      }
    }

    // ---- Replies, mentions and reactions (Phase 3 features) -----------------------------
    const mentions: { messageId: string; userId: string }[] = []
    const reactions: { messageId: string; userId: string; emoji: string; createdAt: Date }[] = []

    messages.forEach((message, index) => {
      if (message.deletedAt || message.content === null) return

      // ~10%: reply to one of the recent (non-deleted) messages
      const recent = messages.slice(Math.max(0, index - 15), index).filter(item => !item.deletedAt)
      if (recent.length && faker.number.float() < 0.1) {
        message.parentId = faker.helpers.arrayElement(recent).id
      }

      // ~8%: mention another member at the start of the message (`<@id>` token)
      const others = memberKeys.filter(key => id(key) !== message.authorId)
      if (others.length && faker.number.float() < 0.08) {
        const mentioned = id(faker.helpers.arrayElement(others))
        message.content = `<@${mentioned}> ${message.content}`
        mentions.push({ messageId: message.id, userId: mentioned })
      }

      // ~20%: one to three emojis, each from a few members
      if (faker.number.float() < 0.2) {
        for (const emoji of faker.helpers.arrayElements(REACTION_EMOJIS, { min: 1, max: 3 })) {
          for (const reactor of faker.helpers.arrayElements(memberKeys, { min: 1, max: Math.min(4, memberKeys.length) })) {
            reactions.push({
              messageId: message.id,
              userId: id(reactor),
              emoji,
              createdAt: new Date(message.createdAt.getTime() + faker.number.int({ min: 5_000, max: 3_600_000 })),
            })
          }
        }
      }
    })

    if (messages.length) await prisma.message.createMany({ data: messages })
    if (mentions.length) await prisma.mention.createMany({ data: mentions })
    if (reactions.length) await prisma.reaction.createMany({ data: reactions })
    totalMessages += messages.length
    totals.replies += messages.filter(message => message.parentId).length
    totals.mentions += mentions.length
    totals.reactions += reactions.length

    // ---- Members + read state ------------------------------------------------------------
    const lastReadFor = (key: UserKey) => {
      const unread = definition.unread?.[key] ?? 0
      // Read up to the message right before the last `unread` messages written by others
      const fromOthers = messages.filter(message => message.authorId !== id(key) && !message.deletedAt)
      if (!unread || !fromOthers.length) return new Date(NOW)
      const firstUnread = fromOthers[Math.max(fromOthers.length - unread, 0)]
      return new Date(firstUnread.createdAt.getTime() - 1)
    }

    await prisma.member.createMany({
      data: memberKeys.map(key => ({
        channelId: channel.id,
        memberId: id(key),
        role: key === definition.owner || definition.admins?.includes(key) ? 'ADMIN' : 'MEMBER',
        lastReadAt: lastReadFor(key),
        createdAt: channel.createdAt,
      })),
    })

    for (const invite of definition.invites ?? []) {
      await prisma.invite.create({
        data: {
          channelId: channel.id,
          authorId: id(invite.author ?? definition.owner),
          inviteeId: id(invite.invitee),
          role: invite.role,
        },
      })
    }
  }

  // ---- Direct messages (1:1) ----------------------------------------------------------
  const directPairs: [UserKey, UserKey, number][] = [
    ['gustavo', 'gabriel', 60],
    ['gustavo', 'user1', 25],
    ['gabriel', 'user5', 15],
    ['user8', 'gustavo', 8],
  ]

  for (const [a, b, count] of directPairs) {
    const createdAt = new Date(NOW - 10 * DAY)
    const dm = await prisma.channel.create({
      data: {
        type: 'DIRECT',
        title: 'Mensagem direta',
        slug: `dm-${faker.string.hexadecimal({ length: 12, prefix: '', casing: 'lower' })}`,
        ownerId: id(a),
        createdAt,
      },
    })

    let time = NOW - faker.number.int({ min: 3, max: 9 }) * DAY
    const step = (NOW - 5 * 60_000 - time) / count
    const dmMessages = Array.from({ length: count }, () => {
      time += faker.number.int({ min: Math.floor(step * 0.3), max: Math.floor(step * 1.7) })
      return {
        id: faker.string.uuid(),
        channelId: dm.id,
        authorId: id(faker.helpers.arrayElement([a, b])),
        content: chatLine(),
        createdAt: new Date(Math.min(time, NOW - 60_000)),
      }
    }).sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime())

    await prisma.message.createMany({ data: dmMessages })
    totalMessages += dmMessages.length

    // The last few messages from the other person stay unread for "a"
    const fromB = dmMessages.filter(message => message.authorId === id(b))
    const unreadFrom = fromB.at(-Math.min(3, fromB.length))?.createdAt
    await prisma.member.createMany({
      data: [
        { channelId: dm.id, memberId: id(a), role: 'MEMBER', createdAt, lastReadAt: unreadFrom ? new Date(unreadFrom.getTime() - 1) : new Date(NOW) },
        { channelId: dm.id, memberId: id(b), role: 'MEMBER', createdAt, lastReadAt: new Date(NOW) },
      ],
    })
  }

  console.log(`Seeded ${users.size} users, ${channels.length} channels, ${directPairs.length} DMs and ${totalMessages} messages.`)
  console.log(`  ${totals.replies} replies, ${totals.mentions} mentions, ${totals.reactions} reactions`)
  console.log(`Logins (password "${PASSWORD}"):`)
  for (const user of users.values()) console.log(`  - ${user.name} <${user.email}>`)
}

seed()
  .then(() => console.log('Database seeded!'))
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
