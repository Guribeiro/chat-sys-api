import type { NextFunction, Request, Response } from 'express'
import type { ZodTypeAny } from 'zod'

type Schemas = {
  body?: ZodTypeAny
  params?: ZodTypeAny
  query?: ZodTypeAny
}

/**
 * Validates and coerces request.body / request.params / request.query with Zod.
 * A ZodError is thrown on failure and turned into a 400 by the error handler in app.ts.
 */
export function validate(schemas: Schemas) {
  return (request: Request, _response: Response, next: NextFunction) => {
    if (schemas.params) request.params = schemas.params.parse(request.params)
    if (schemas.query) request.query = schemas.query.parse(request.query)
    if (schemas.body) request.body = schemas.body.parse(request.body)
    next()
  }
}
