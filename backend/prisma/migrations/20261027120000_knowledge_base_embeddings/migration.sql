-- pgvector (available on Neon). Safe to run on a database that already has it.
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateTable
CREATE TABLE "knowledge_base_embeddings" (
    "id" TEXT NOT NULL,
    "locale" "UserLocale" NOT NULL,
    "source" TEXT NOT NULL,
    "heading" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(768) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_base_embeddings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "knowledge_base_embeddings_locale_idx" ON "knowledge_base_embeddings"("locale");

-- No vector index yet: a few dozen rows are scanned exactly in under a millisecond. Add an HNSW index (vector_cosine_ops) past a few thousand rows.
