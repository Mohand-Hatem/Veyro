-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "completedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "tasks_projectId_completedAt_idx" ON "tasks"("projectId", "completedAt");


-- Backfill (ADR-002): tasks that are already DONE get their last update time as completion time.
UPDATE "tasks" SET "completedAt" = "updatedAt" WHERE "status" = 'DONE' AND "completedAt" IS NULL;
