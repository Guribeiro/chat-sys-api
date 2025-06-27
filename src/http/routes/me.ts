import { Router } from "express";

import { GetMemberChannelsController } from '../controllers/channels/get-member-channels';

import { ensureAuthentication } from '../middlewares/ensure-authenticate';

const meRouter = Router()

const getMemberChannelsController = new GetMemberChannelsController()

meRouter.get('/channels', ensureAuthentication, getMemberChannelsController.handle)

export { meRouter }