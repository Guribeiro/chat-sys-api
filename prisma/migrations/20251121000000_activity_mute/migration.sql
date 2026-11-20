-- AlterTable
ALTER TABLE "users" ADD COLUMN     "activity_seen_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "members" ADD COLUMN     "muted" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "messages_parent_id_idx" ON "messages"("parent_id");
