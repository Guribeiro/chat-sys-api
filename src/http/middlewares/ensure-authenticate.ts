import { UnauthorizedError } from '@/http/_errors/unauthorized-error';
import type { NextFunction, Request, Response } from 'express';
import { verify } from 'jsonwebtoken';

interface TokenPayload {
  iat: number;
  exp: number;
  sub: string;
}

export function ensureAuthentication(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const authorization = request.headers.authorization;

  if (!authorization) {
    throw new UnauthorizedError('JTW is missing');
  }

  const [, token] = authorization.split(' ');


  try {
    const decoded = verify(token, 'secret');

    const { sub } = decoded as TokenPayload;

    request.user = {
      id: sub,
    };

    return next();
  } catch (error) {
    throw new UnauthorizedError('invalid_jwt_token');
  }
}
