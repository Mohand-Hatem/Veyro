-- CS-01 / ADR-003: short per-workspace project code.
-- Expand step: add the column nullable, backfill every existing row, then enforce NOT NULL + uniqueness.

-- AlterTable
ALTER TABLE "projects" ADD COLUMN "key" VARCHAR(5);

-- Backfill: first three letters/digits of the name (prefixed with "P" when it starts with a digit,
-- "PRJ" when empty), numbered per workspace on collision so that every key is unique.
WITH cleaned AS (
  SELECT "id", "workspaceId", "createdAt",
         upper(regexp_replace("name", '[^A-Za-z0-9]', '', 'g')) AS alnum
  FROM "projects"
), based AS (
  SELECT "id", "workspaceId", "createdAt",
         CASE
           WHEN length(alnum) = 0 THEN 'PRJ'
           WHEN alnum ~ '^[0-9]' THEN left('P' || alnum, 3)
           WHEN length(alnum) < 2 THEN alnum || 'X'
           ELSE left(alnum, 3)
         END AS base
  FROM cleaned
), numbered AS (
  SELECT "id", base,
         row_number() OVER (PARTITION BY "workspaceId", base ORDER BY "createdAt", "id") AS rn
  FROM based
)
UPDATE "projects" p
SET "key" = CASE WHEN n.rn = 1 THEN n.base ELSE left(n.base, 3) || n.rn::text END
FROM numbered n
WHERE n."id" = p."id";

-- Enforce
ALTER TABLE "projects" ALTER COLUMN "key" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "projects_workspaceId_key_key" ON "projects"("workspaceId", "key");
