-- CS-05 / ADR-012: project-level roles, protected project creator, task category.
-- Expand-only: new nullable/defaulted columns, then a backfill. Nothing is dropped.

-- CreateEnum
CREATE TYPE "ProjectRole" AS ENUM ('ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "TaskCategory" AS ENUM ('FEATURE', 'BUG', 'IMPROVEMENT', 'DESIGN', 'RESEARCH', 'DOCS', 'OTHER');

-- AlterTable
ALTER TABLE "project_members" ADD COLUMN     "role" "ProjectRole" NOT NULL DEFAULT 'MEMBER';

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "createdById" TEXT;

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "category" "TaskCategory";

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: projects never recorded their creator, but the creator was always added as the first member.
-- The earliest member becomes the protected creator and a project admin.
UPDATE "projects" p
SET "createdById" = first_member."userId"
FROM (
  SELECT DISTINCT ON ("projectId") "projectId", "userId"
  FROM "project_members"
  ORDER BY "projectId", "assignedAt" ASC, "id" ASC
) first_member
WHERE first_member."projectId" = p."id" AND p."createdById" IS NULL;

UPDATE "project_members" pm
SET "role" = 'ADMIN'
FROM "projects" p
WHERE p."id" = pm."projectId" AND p."createdById" = pm."userId";
