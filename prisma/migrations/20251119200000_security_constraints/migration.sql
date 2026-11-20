-- DropIndex
DROP INDEX "invites_channel_id_key";

-- AlterTable
ALTER TABLE "tokens" ADD COLUMN     "expires_at" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "invites_channel_id_invitee_id_key" ON "invites"("channel_id", "invitee_id");

-- CreateIndex
CREATE UNIQUE INDEX "members_channel_id_member_id_key" ON "members"("channel_id", "member_id");

-- CreateIndex
CREATE INDEX "messages_channel_id_created_at_idx" ON "messages"("channel_id", "created_at");

