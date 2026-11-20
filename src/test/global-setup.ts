import { execSync } from 'node:child_process'
import { testDatabaseUrl } from './test-env'

/** Recreates the test database from the migrations once per run (never touches the dev DB). */
export default function setup() {
  if (!testDatabaseUrl.includes('test')) {
    throw new Error(`Refusing to reset a database that does not look like a test one: ${testDatabaseUrl}`)
  }
  execSync('npx prisma migrate reset --force --skip-seed --skip-generate', {
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
    stdio: 'ignore',
  })
}
