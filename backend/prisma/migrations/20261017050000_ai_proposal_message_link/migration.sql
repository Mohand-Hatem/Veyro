-- CS-06 / ADR-013: link an AI mutation proposal to the assistant message that carries it.
-- Expand-only: one nullable, unique column. Legacy proposals simply stay unlinked.

-- AlterTable
ALTER TABLE "ai_mutation_proposals" ADD COLUMN     "messageId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ai_mutation_proposals_messageId_key" ON "ai_mutation_proposals"("messageId");

-- AddForeignKey
ALTER TABLE "ai_mutation_proposals" ADD CONSTRAINT "ai_mutation_proposals_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ai_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
