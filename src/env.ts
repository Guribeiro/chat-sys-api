import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  ENDPOINT_URL: z.string().url(),
  PORT: z.coerce.number(),
  HOST: z.string(),
  JWT_SECRET: z.string().min(1),
  // Comma-separated list of allowed origins for Socket.io CORS
  WEB_URL: z.string().default('http://localhost:8080'),
  // Where uploaded files are written (local storage driver)
  UPLOADS_DIR: z.string().default('uploads'),
  // Max size of a single uploaded file, in megabytes
  MAX_UPLOAD_MB: z.coerce.number().positive().default(10),
  // Sessions: short-lived JWT access token + rotating opaque refresh token
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_DAYS: z.coerce.number().int().positive().default(30),
  // E-mail (optional). Without SMTP_HOST, e-mails are only printed to the API log.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default('Realtime chat <no-reply@chat.local>'),
});


export const env = envSchema.parse(process.env);

export type Enviroment = z.infer<typeof envSchema>;
