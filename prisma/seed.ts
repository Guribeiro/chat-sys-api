import { faker } from '@faker-js/faker'
import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'
import { createSlug } from '@/utils/create-slug'

const prisma = new PrismaClient()

async function seed() {
  await prisma.member.deleteMany()
  await prisma.invite.deleteMany()
  await prisma.message.deleteMany()
  await prisma.channel.deleteMany()
  await prisma.user.deleteMany()

  const passwordHash = await hash('123456', 1)

  const user = await prisma.user.create({
    data: {
      email: 'gustavo@gmail.com',
      password: passwordHash,
      name: 'Gustavo',
    }
  })

  const user2 = await prisma.user.create({
    data: {
      email: 'gabriel@gmail.com',
      password: passwordHash,
      name: 'Gabriel',
    }
  })

  await prisma.channel.create({
    data: {
      slug: createSlug('TI'),
      title: 'TI',
      description: 'channel-description',
      ownerId: user.id,
      members: {
        createMany: {
          data: [
            {
              memberId: user.id,
              role: 'ADMIN'
            },
          ]
        }
      },
      invites: {
        create: {
          authorId: user.id,
          inviteeId: user2.id,
          role: 'MEMBER'
        },
      }
    }
  })


  await prisma.channel.create({
    data: {
      slug: createSlug('Recursos Humanos'),
      title: 'Recursos Humanos',
      ownerId: user2.id,
      description: 'channel-description',
      members: {
        createMany: {
          data: [
            {
              memberId: user2.id,
              role: 'ADMIN'
            }
          ]
        }
      },
      invites: {
        create: {
          authorId: user2.id,
          inviteeId: user.id,
          role: 'MEMBER'
        }
      }
    }
  })
}

seed().then(() => {
  console.log('Database seeded!')
}).catch((error) => console.log(error))