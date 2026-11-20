import { Router } from "express";

import { ListUsersController } from "../controllers/users/list-users";
import { ensureAuthentication } from "../middlewares/ensure-authenticate";
import { validate } from "../middlewares/validate";
import { listUsersQuery } from "../schemas";

const usersRouter = Router()

const listUsersController = new ListUsersController()

usersRouter.get('/', ensureAuthentication, validate({ query: listUsersQuery }), listUsersController.handle)

export { usersRouter }
