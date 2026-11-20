/** Environment shared by the Vitest config and the global setup (separate processes). */
export const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ?? 'postgresql://docker:docker@db:5432/chat_test?schema=public'

export const testEnv = {
  NODE_ENV: 'test',
  DATABASE_URL: testDatabaseUrl,
  JWT_SECRET: 'test-secret',
  ENDPOINT_URL: 'http://localhost:3333',
  PORT: '0',
  HOST: 'localhost',
  WEB_URL: 'http://localhost:8080',
  UPLOADS_DIR: '/tmp/chat-test-uploads',
  // No SMTP in tests: e-mails are only logged
  SMTP_HOST: '',
}
