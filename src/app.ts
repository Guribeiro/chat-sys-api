import 'express-async-errors';
import cors from 'cors';
import { routes } from './http/routes';

import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express';
import { NotFoundError, UnauthorizedError, BadRequestError } from './http/_errors';

const app = express()

app.use(cors())
app.use(express.json());
app.use(routes)

// Middleware to parse URL-encoded bodies (for form submissions)
// { extended: true } allows for rich objects and arrays to be encoded into the URL-encoded format
app.use(express.urlencoded({ extended: true }));

app.use(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (err: Error, request: Request, response: Response, next: NextFunction) => {
    console.log({ err })
    if (err instanceof UnauthorizedError) {
      return response.status(401).json({
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

    return response.status(500).json({
      message: `Internal server error - ${err.message}`,
    });
  },
);



export { app }
