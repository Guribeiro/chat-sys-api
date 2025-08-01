import { Router } from "express";

import { sessionsRouter } from "./auth";
import { channelsRouter } from "./channels";
import { meRouter } from "./me";
import { usersRouter } from "./users";

const routes = Router()

routes.use('/sessions', sessionsRouter)
routes.use('/channels', channelsRouter)
routes.use('/me', meRouter)
routes.use('/users', usersRouter)


export { routes }