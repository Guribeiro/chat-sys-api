import 'express-async-errors';
import cors from 'cors';
import { ZodError } from 'zod';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { MulterError } from 'multer';
import path from 'node:path';
import { UPLOADS_ROUTE, uploadsDir } from './lib/storage';
import { IMAGE_TYPES } from './lib/uploads';
import { routes } from './http/routes';
import { env } from './env';

import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express';
import { NotFoundError, UnauthorizedError, BadRequestError, ForbiddenError } from './http/_errors';

const app = express()

app.disable('x-powered-by')
// cross-origin resource policy: the web app (another origin) must be able to load uploaded images
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
app.use(cors({ origin: env.WEB_URL.split(',').map((origin) => origin.trim()) }))

// Brute-force protection for login, sign-up and password recovery
app.use('/sessions', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { message: 'Too many attempts, please try again in a few minutes' },
}))

// Uploaded files. Names are random UUIDs; only images may render inline, everything else downloads.
const inlineExtensions = new Set(Object.values(IMAGE_TYPES).concat('webp').map((extension) => `.${extension}`))
app.use(UPLOADS_ROUTE, express.static(uploadsDir, {
  index: false,
  dotfiles: 'deny',
  fallthrough: false,
  immutable: true,
  maxAge: '365d',
  setHeaders: (response, filePath) => {
    response.setHeader('X-Content-Type-Options', 'nosniff')
    response.setHeader('Content-Security-Policy', "default-src 'none'; sandbox")
    if (!inlineExtensions.has(path.extname(filePath).toLowerCase())) {
      response.setHeader('Content-Disposition', 'attachment')
    }
  },
}))

app.use(express.json({ limit: '100kb' }));
// Parses URL-encoded bodies (form submissions). Must run before the routes.
app.use(express.urlencoded({ extended: true }));
app.use(routes)

app.use(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (err: Error, request: Request, response: Response, next: NextFunction) => {
    if (err instanceof MulterError) {
      const messages: Partial<Record<MulterError['code'], string>> = {
        LIMIT_FILE_SIZE: `File too large (max ${env.MAX_UPLOAD_MB} MB)`,
        LIMIT_FILE_COUNT: 'Too many files',
        LIMIT_UNEXPECTED_FILE: 'Unexpected file field',
      }
      return response.status(400).json({ message: messages[err.code] ?? err.message })
    }

    // http-errors from express.static/send (404 missing file, 403 malicious path, ...)
    const status = (err as { status?: unknown }).status
    if (typeof status === 'number' && status >= 400 && status < 500) {
      return response.status(status).json({ message: status === 404 ? 'Not found' : 'Request rejected' })
    }

    if (err instanceof ZodError) {
      return response.status(400).json({
        message: 'Dados inválidos',
        errors: err.flatten().fieldErrors,
      });
    }

    if (err instanceof UnauthorizedError) {
      return response.status(401).json({
        message: err.message,
      });
    }

    if (err instanceof ForbiddenError) {
      return response.status(403).json({
        message: err.message,
      });
    }

    if (err instanceof BadRequestError) {
      return response.status(400).json({
        message: err.message,
      });
    }

    if (err instanceof NotFoundError) {
      return response.status(404).json({
        message: err.message,
      });
    }

    console.error(err)

    // Never leak internal error details to the client
    return response.status(500).json({
      message: 'Internal server error',
    });
  },
);

export { app }
