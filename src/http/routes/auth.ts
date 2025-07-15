import { Router } from 'express';

const sessionsRouter = Router();

import { AuthenticateWithPasswordController } from '../controllers/auth/authenticate-with-password';
import { RequestPasswordRecoverController } from '../controllers/auth/request-password-recover';
import { ResetPasswordController } from '../controllers/auth/reset-password'

const authenticateWithPasswordController = new AuthenticateWithPasswordController()
const requestPasswordRecoverController = new RequestPasswordRecoverController()
const resetPasswordController = new ResetPasswordController()

sessionsRouter.post('/password', authenticateWithPasswordController.handle)
sessionsRouter.post('/password/recover', requestPasswordRecoverController.handle)
sessionsRouter.post('/password/reset', resetPasswordController.handle)


export { sessionsRouter }