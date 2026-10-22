-- CreateEnum
CREATE TYPE "ContactTopic" AS ENUM ('QUESTION', 'PROBLEM', 'BILLING', 'FEEDBACK', 'OTHER');

-- CreateEnum
CREATE TYPE "ContactStatus" AS ENUM ('NEW', 'HANDLED');

-- CreateTable
CREATE TABLE "contact_messages" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "topic" "ContactTopic" NOT NULL,
    "message" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "status" "ContactStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contact_messages_email_createdAt_idx" ON "contact_messages"("email", "createdAt");

-- CreateIndex
CREATE INDEX "contact_messages_ipHash_createdAt_idx" ON "contact_messages"("ipHash", "createdAt");

-- CreateIndex
CREATE INDEX "contact_messages_status_createdAt_idx" ON "contact_messages"("status", "createdAt");

