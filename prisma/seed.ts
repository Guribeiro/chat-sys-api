import { faker } from '@faker-js/faker'
import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'
import { createSlug } from '@/utils/create-slug'

const prisma = new PrismaClient()

async function seed() {
  await prisma.membership.deleteMany()
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

  await prisma.user.createMany({
    data: [
      {
        email: faker.internet.email(),
        name: faker.person.firstName(),
        password: passwordHash,
      },
      {
        email: faker.internet.email(),
        name: faker.person.firstName(),
        password: passwordHash,
      },
      {
        email: faker.internet.email(),
        name: faker.person.firstName(),
        password: passwordHash,
      },
    ]
  })

  await prisma.channel.create({
    data: {
      slug: createSlug('TI'),
      title: 'TI',
      description: 'channel-description',
      memberships: {
        createMany: {
          data: [
            {
              memberId: user.id,
            },
            {
              memberId: user2.id,
            }
          ]
        }
      },
      messages: {
        createMany: {
          data: [
            {
              authorId: user.id,
              content: faker.lorem.sentence(),
            },
            {
              authorId: user.id,
              content: faker.lorem.sentence(),
            },
            {
              authorId: user2.id,
              content: faker.lorem.sentence(),
            },
            {
              authorId: user2.id,
              content: faker.lorem.sentence(),
            }
          ]
        }
      }
    }
  })
  await prisma.channel.create({
    data: {
      slug: createSlug('Recursos Humanos'),
      title: 'Recursos Humanos',
      description: 'channel-description',
      memberships: {
        createMany: {
          data: [
            {
              memberId: user.id,
            },
            {
              memberId: user2.id,
            }
          ]
        }
      },
      messages: {
        createMany: {
          data: [
            {
              authorId: user.id,
              content: faker.lorem.sentence(),
            },
            {
              authorId: user.id,
              content: faker.lorem.sentence(),
            },
            {
              authorId: user2.id,
              content: faker.lorem.sentence(),
            },
            {
              authorId: user2.id,
              content: faker.lorem.sentence(),
            }
          ]
        }
      }
    }
  })
}

seed().then(() => {
  console.log('Database seeded!')
}).catch((error) => console.log(error))