import { Router } from "express";

import { GetMemberChannelsController } from '../controllers/channels/get-member-channels';

import { RejectInviteController } from '../controllers/invites/reject-invite';
import { AcceptInviteController } from '../controllers/invites/accept-invite';
import { GetPendingInvitesController } from "../controllers/invites/get-pending-invites";

import { GetProfileController } from '../controllers/me/get-profile';
import { ChangePasswordController, UpdateProfileController } from '../controllers/me/update-profile';
import { OpenDirectMessageController } from '../controllers/direct-messages/open-direct-message';
import { SearchMessagesController } from '../controllers/search/search-messages';
import { DeleteAvatarController, UpdateAvatarController } from '../controllers/me/update-avatar';
import { upload } from '@/lib/uploads';
import { GetActivityController, MarkActivitySeenController } from '../controllers/me/get-activity';

import { ensureAuthentication } from '../middlewares/ensure-authenticate';
import { validate } from '../middlewares/validate';
import { activityQuery, changePasswordBody, directMessageBody, inviteParams, memberChannelsQuery, searchQuery, updateProfileBody } from '../schemas';

const meRouter = Router()

const getMemberChannelsController = new GetMemberChannelsController()
const rejectInviteController = new RejectInviteController();
const acceptInviteController = new AcceptInviteController();
const getPendingInvitesController = new GetPendingInvitesController()
const getProfileController = new GetProfileController()
const updateProfileController = new UpdateProfileController()
const changePasswordController = new ChangePasswordController()
const openDirectMessageController = new OpenDirectMessageController()
const searchMessagesController = new SearchMessagesController()
const updateAvatarController = new UpdateAvatarController()
const deleteAvatarController = new DeleteAvatarController()
const getActivityController = new GetActivityController()
const markActivitySeenController = new MarkActivitySeenController()

meRouter.use(ensureAuthentication)

meRouter.get('/', getProfileController.handle)
meRouter.patch('/', validate({ body: updateProfileBody }), updateProfileController.handle)
meRouter.patch('/password', validate({ body: changePasswordBody }), changePasswordController.handle)
meRouter.post('/direct-messages', validate({ body: directMessageBody }), openDirectMessageController.handle)
meRouter.get('/search', validate({ query: searchQuery }), searchMessagesController.handle)
meRouter.put('/avatar', upload.single('avatar'), updateAvatarController.handle)
meRouter.delete('/avatar', deleteAvatarController.handle)

meRouter.get('/activity', validate({ query: activityQuery }), getActivityController.handle)
meRouter.post('/activity/seen', markActivitySeenController.handle)

meRouter.get('/channels', validate({ query: memberChannelsQuery }), getMemberChannelsController.handle)

meRouter.post('/invites/:inviteId/reject', validate({ params: inviteParams }), rejectInviteController.handle)
meRouter.post('/invites/:inviteId/accept', validate({ params: inviteParams }), acceptInviteController.handle)
meRouter.get('/pending-invites', getPendingInvitesController.handle)

export { meRouter }
