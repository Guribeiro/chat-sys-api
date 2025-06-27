import { Router } from 'express';

const channelsRouter = Router();

import { GetChannelMembers } from '../controllers/channels/get-channel-members';
import { GetChannelMessages } from '../controllers/channels/get-channel-messages';
import { CreateChannelMessage } from '../controllers/channels/create-channel-message';

import { ensureAuthentication } from '../middlewares/ensure-authenticate';

const getChannelMembers = new GetChannelMembers()
const getChannelMessages = new GetChannelMessages()
const createChannelMessage = new CreateChannelMessage()

channelsRouter.get('/:slug/members', ensureAuthentication, getChannelMembers.handle)

channelsRouter.get('/:slug/messages', ensureAuthentication, getChannelMessages.handle)
channelsRouter.post('/:slug/messages', ensureAuthentication, createChannelMessage.handle)

export { channelsRouter }