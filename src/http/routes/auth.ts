import { Router } from 'express';

import { AuthenticateWithPasswordController } from '../controllers/auth/authenticate-with-password';
import { RequestPasswordRecoverController } from '../controllers/auth/request-password-recover';
import { ResetPasswordController } from '../controllers/auth/reset-password'
import { CreateAccountController } from '../controllers/auth/create-account'
import { LogoutController, RefreshSessionController } from '../controllers/auth/refresh-session'

import { validate } from '../middlewares/validate';
import {
  authenticateBody,
  createAccountBody,
  refreshTokenBody,
  requestPasswordRecoverBody,
  resetPasswordBody,
} from '../schemas';

const sessionsRouter = Router();

const authenticateWithPasswordController = new AuthenticateWithPasswordController()
const requestPasswordRecoverController = new RequestPasswordRecoverController()
const resetPasswordController = new ResetPasswordController()
const createAccountController = new CreateAccountController()
const refreshSessionController = new RefreshSessionController()
const logoutController = new LogoutController()

sessionsRouter.post('/account', validate({ body: createAccountBody }), createAccountController.handle)
sessionsRouter.post('/password', validate({ body: authenticateBody }), authenticateWithPasswordController.handle)
sessionsRouter.post('/password/recover', validate({ body: requestPasswordRecoverBody }), requestPasswordRecoverController.handle)
sessionsRouter.post('/refresh', validate({ body: refreshTokenBody }), refreshSessionController.handle)
sessionsRouter.post('/logout', validate({ body: refreshTokenBody }), logoutController.handle)
sessionsRouter.post('/password/reset', validate({ body: resetPasswordBody }), resetPasswordController.handle)

export { sessionsRouter }
