import { Router } from 'express';

const channelsRouter = Router();

import { GetChannelMembersController } from '../controllers/channels/get-channel-members';
import { GetChannelMessagesController } from '../controllers/channels/get-channel-messages';
import { CreateChannelMessageController } from '../controllers/channels/create-channel-message';
import { GetChannelInvitesController } from '../controllers/channels/get-channel-invites'

import { RevokeInviteController } from '../controllers/invites/revoke-invite';

import { ensureAuthentication } from '../middlewares/ensure-authenticate';

const getChannelMembersController = new GetChannelMembersController()
const getChannelMessagesController = new GetChannelMessagesController()
const createChannelMessageController = new CreateChannelMessageController()
const getChannelInvitesController = new GetChannelInvitesController()

const revokeInviteController = new RevokeInviteController()

channelsRouter.get('/:slug/members', ensureAuthentication, getChannelMembersController.handle)

channelsRouter.get('/:slug/messages', ensureAuthentication, getChannelMessagesController.handle)
channelsRouter.post('/:slug/messages', ensureAuthentication, createChannelMessageController.handle)

channelsRouter.get('/:slug/invites', ensureAuthentication, getChannelInvitesController.handle)
channelsRouter.delete('/:slug/invites/:inviteId', ensureAuthentication, revokeInviteController.handle)

export { channelsRouter }