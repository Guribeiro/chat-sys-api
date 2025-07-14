import { Router } from 'express';

const channelsRouter = Router();

import { CreateChannelController } from '../controllers/channels/create-channel';
import { UpdateChannelController } from '../controllers/channels/update-channel';
import { DeleteChannelController } from '../controllers/channels/delete-channel';
import { UpdateChannelStatus } from '../controllers/channels/update-channel-status';

import { CreateChannelMessageController } from '../controllers/channels/create-channel-message';
import { GetChannelController } from '../controllers/channels/get-channel';
import { GetChannelInvitesController } from '../controllers/channels/get-channel-invites';
import { GetChannelMembersController } from '../controllers/channels/get-channel-members';
import { GetChannelMessagesController } from '../controllers/channels/get-channel-messages';
import { RemoveChannelMemberController } from '../controllers/channels/remove-channel-member';
import { CreateInviteController } from '../controllers/invites/create-invite';

import { RevokeInviteController } from '../controllers/invites/revoke-invite';

import { ensureAuthentication } from '../middlewares/ensure-authenticate';

const createChannelController = new CreateChannelController()
const updateChannelController = new UpdateChannelController()
const deleteChannelController = new DeleteChannelController()
const getChannelController = new GetChannelController()

const getChannelMembersController = new GetChannelMembersController()
const removeChannelMemberController = new RemoveChannelMemberController()

const getChannelMessagesController = new GetChannelMessagesController()
const createChannelMessageController = new CreateChannelMessageController()

const getChannelInvitesController = new GetChannelInvitesController()
const createInviteController = new CreateInviteController()
const revokeInviteController = new RevokeInviteController()

const updateChannelStatus = new UpdateChannelStatus()

channelsRouter.post('/', ensureAuthentication, createChannelController.handle)
channelsRouter.get('/:slug', ensureAuthentication, getChannelController.handle)
channelsRouter.delete('/:slug', ensureAuthentication, deleteChannelController.handle)
channelsRouter.put('/:slug', ensureAuthentication, updateChannelController.handle)

channelsRouter.patch('/:slug/active', ensureAuthentication, updateChannelStatus.handle)

channelsRouter.get('/:slug/members', ensureAuthentication, getChannelMembersController.handle)
channelsRouter.delete('/:slug/members/:memberId', ensureAuthentication, removeChannelMemberController.handle)

channelsRouter.get('/:slug/messages', ensureAuthentication, getChannelMessagesController.handle)
channelsRouter.post('/:slug/messages', ensureAuthentication, createChannelMessageController.handle)

channelsRouter.get('/:slug/invites', ensureAuthentication, getChannelInvitesController.handle)
channelsRouter.post('/:slug/invites', ensureAuthentication, createInviteController.handle)
channelsRouter.delete('/:slug/invites/:inviteId', ensureAuthentication, revokeInviteController.handle)

export { channelsRouter };
