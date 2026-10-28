-- CreateEnum
CREATE TYPE "AvatarType" AS ENUM ('INITIALS', 'PRESET', 'UPLOAD');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "avatarType" "AvatarType" NOT NULL DEFAULT 'INITIALS',
ADD COLUMN     "avatarPresetKey" TEXT,
ADD COLUMN     "avatarRemovedAt" TIMESTAMP(3);

-- Everyone who already has a picture address (a stored photo or a Google/GitHub photo) is an UPLOAD; everyone else shows initials.
UPDATE "users" SET "avatarType" = 'UPLOAD' WHERE "avatarUrl" IS NOT NULL;
