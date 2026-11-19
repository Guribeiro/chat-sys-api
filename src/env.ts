import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  ENDPOINT_URL: z.string().url(),
  PORT: z.coerce.number(),
  HOST: z.string(),
  JWT_SECRET: z.string().min(1),
  // Comma-separated list of allowed origins for Socket.io CORS
  WEB_URL: z.string().default('http://localhost:8080'),
});


export const env = envSchema.parse(process.env);

export type Enviroment = z.infer<typeof envSchema>;
