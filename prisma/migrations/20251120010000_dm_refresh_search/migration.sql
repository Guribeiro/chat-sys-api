-- CreateEnum
CREATE TYPE "ChannelType" AS ENUM ('GROUP', 'DIRECT');

-- AlterTable
ALTER TABLE "channels" ADD COLUMN     "type" "ChannelType" NOT NULL DEFAULT 'GROUP';

-- AlterTable
ALTER TABLE "tokens" ADD COLUMN     "token_hash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "tokens_token_hash_key" ON "tokens"("token_hash");


-- Full-text search over message content (Portuguese stemming). Kept outside Prisma's schema:
-- Prisma can not express expression indexes, so this lives only in this migration.
CREATE INDEX "messages_content_fts_idx" ON "messages" USING GIN (to_tsvector('portuguese', coalesce("content", '')));
