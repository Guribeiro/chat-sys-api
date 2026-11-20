import { Router } from 'express';

import { CreateChannelController } from '../controllers/channels/create-channel';
import { UpdateChannelController } from '../controllers/channels/update-channel';
import { DeleteChannelController } from '../controllers/channels/delete-channel';
import { UpdateChannelStatus } from '../controllers/channels/update-channel-status';

import { CreateChannelMessageController } from '../controllers/channels/create-channel-message';
import { GetChannelController } from '../controllers/channels/get-channel';
import { GetChannelInvitesController } from '../controllers/channels/get-channel-invites';
import { GetChannelMembersController } from '../controllers/channels/get-channel-members';
import { GetChannelMessagesController } from '../controllers/channels/get-channel-messages';
import { UpdateChannelMessageController } from '../controllers/channels/update-channel-message';
import { DeleteChannelMessageController } from '../controllers/channels/delete-channel-message';
import { ToggleMessageReactionController } from '../controllers/channels/toggle-message-reaction';
import { UploadAttachmentsController } from '../controllers/attachments/upload-attachments';
import { upload, MAX_FILES_PER_MESSAGE } from '@/lib/uploads';
import { UpdateChannelNotificationsController } from '../controllers/channels/update-channel-notifications';
import { MarkChannelReadController } from '../controllers/channels/mark-channel-read';
import { RemoveChannelMemberController } from '../controllers/channels/remove-channel-member';
import { CreateInviteController } from '../controllers/invites/create-invite';
import { RevokeInviteController } from '../controllers/invites/revoke-invite';

import { ensureAuthentication } from '../middlewares/ensure-authenticate';
import { validate } from '../middlewares/validate';
import {
  channelBody,
  channelInviteParams,
  channelNotificationsBody,
  channelStatusBody,
  createInviteBody,
  createMessageBody,
  memberParams,
  messageParams,
  messagesQuery,
  reactionBody,
  updateMessageBody,
  slugParams,
} from '../schemas';

const channelsRouter = Router();

const createChannelController = new CreateChannelController()
const updateChannelController = new UpdateChannelController()
const deleteChannelController = new DeleteChannelController()
const getChannelController = new GetChannelController()

const getChannelMembersController = new GetChannelMembersController()
const removeChannelMemberController = new RemoveChannelMemberController()

const getChannelMessagesController = new GetChannelMessagesController()
const createChannelMessageController = new CreateChannelMessageController()
const updateChannelMessageController = new UpdateChannelMessageController()
const deleteChannelMessageController = new DeleteChannelMessageController()
const markChannelReadController = new MarkChannelReadController()
const updateChannelNotificationsController = new UpdateChannelNotificationsController()
const uploadAttachmentsController = new UploadAttachmentsController()
const toggleMessageReactionController = new ToggleMessageReactionController()

const getChannelInvitesController = new GetChannelInvitesController()
const createInviteController = new CreateInviteController()
const revokeInviteController = new RevokeInviteController()

const updateChannelStatus = new UpdateChannelStatus()

channelsRouter.use(ensureAuthentication)

channelsRouter.post('/', validate({ body: channelBody }), createChannelController.handle)
channelsRouter.get('/:slug', validate({ params: slugParams }), getChannelController.handle)
channelsRouter.delete('/:slug', validate({ params: slugParams }), deleteChannelController.handle)
channelsRouter.put('/:slug', validate({ params: slugParams, body: channelBody }), updateChannelController.handle)

channelsRouter.patch('/:slug/active', validate({ params: slugParams, body: channelStatusBody }), updateChannelStatus.handle)

channelsRouter.get('/:slug/members', validate({ params: slugParams }), getChannelMembersController.handle)
channelsRouter.delete('/:slug/members/:memberId', validate({ params: memberParams }), removeChannelMemberController.handle)

channelsRouter.get('/:slug/messages', validate({ params: slugParams, query: messagesQuery }), getChannelMessagesController.handle)
channelsRouter.post('/:slug/messages', validate({ params: slugParams, body: createMessageBody }), createChannelMessageController.handle)
channelsRouter.patch('/:slug/messages/:messageId', validate({ params: messageParams, body: updateMessageBody }), updateChannelMessageController.handle)
channelsRouter.delete('/:slug/messages/:messageId', validate({ params: messageParams }), deleteChannelMessageController.handle)
channelsRouter.post('/:slug/messages/:messageId/reactions', validate({ params: messageParams, body: reactionBody }), toggleMessageReactionController.handle)

channelsRouter.post('/:slug/attachments', validate({ params: slugParams }), upload.array('files', MAX_FILES_PER_MESSAGE), uploadAttachmentsController.handle)

channelsRouter.patch('/:slug/notifications', validate({ params: slugParams, body: channelNotificationsBody }), updateChannelNotificationsController.handle)
channelsRouter.post('/:slug/read', validate({ params: slugParams }), markChannelReadController.handle)

channelsRouter.get('/:slug/invites', validate({ params: slugParams }), getChannelInvitesController.handle)
channelsRouter.post('/:slug/invites', validate({ params: slugParams, body: createInviteBody }), createInviteController.handle)
channelsRouter.delete('/:slug/invites/:inviteId', validate({ params: channelInviteParams }), revokeInviteController.handle)

export { channelsRouter };
