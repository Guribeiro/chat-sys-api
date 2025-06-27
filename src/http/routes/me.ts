import { Router } from "express";

import { GetMemberChannelsController } from '../controllers/channels/get-member-channels';

import { RejectInviteController } from '../controllers/invites/reject-invite';
import { AcceptInviteController } from '../controllers/invites/accept-invite';
import { GetPendingInvitesController } from "../controllers/invites/get-pending-invites";

import { ensureAuthentication } from '../middlewares/ensure-authenticate';

const meRouter = Router()

const getMemberChannelsController = new GetMemberChannelsController()
const rejectInviteController = new RejectInviteController();
const acceptInviteController = new AcceptInviteController();
const getPendingInvitesController = new GetPendingInvitesController()

meRouter.get('/channels', ensureAuthentication, getMemberChannelsController.handle)

meRouter.post('/invites/:inviteId/reject', ensureAuthentication, rejectInviteController.handle)
meRouter.post('/invites/:inviteId/accept', ensureAuthentication, acceptInviteController.handle)
meRouter.get('/pending-invites', ensureAuthentication, getPendingInvitesController.handle)

export { meRouter }