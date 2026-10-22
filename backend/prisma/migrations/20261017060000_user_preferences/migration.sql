-- CreateEnum
CREATE TYPE "UserLocale" AS ENUM ('EN', 'AR');

-- CreateEnum
CREATE TYPE "UserTheme" AS ENUM ('LIGHT', 'DARK', 'SYSTEM');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "locale" "UserLocale" NOT NULL DEFAULT 'EN',
ADD COLUMN     "theme" "UserTheme" NOT NULL DEFAULT 'SYSTEM';

