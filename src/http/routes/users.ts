import { Router } from "express";

const usersRouter = Router()

import { ListUsersController } from "../controllers/users/list-users";
import { ensureAuthentication } from "../middlewares/ensure-authenticate";

const listUsersController = new ListUsersController()

usersRouter.get('/', ensureAuthentication, listUsersController.handle)

export { usersRouter }
