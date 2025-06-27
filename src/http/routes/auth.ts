import { Router } from 'express';

const sessionsRouter = Router();

import { AuthenticateWithPasswordController } from '../controllers/auth/authenticate-with-password';

const authenticateWithPasswordController = new AuthenticateWithPasswordController()

sessionsRouter.post('/password', authenticateWithPasswordController.handle)

export { sessionsRouter }