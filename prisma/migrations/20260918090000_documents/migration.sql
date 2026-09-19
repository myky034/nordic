BEGIN;

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "source_id" UUID NOT NULL,
    "canonical_url" TEXT NOT NULL,
    "title" TEXT,
    "document_type" TEXT NOT NULL DEFAULT 'unknown',
    "content_hash" VARCHAR(64) NOT NULL,
    "hash_method" TEXT NOT NULL DEFAULT 'sha256-raw-v1',
    "metadata_hash" VARCHAR(64) NOT NULL,
    "excerpt" TEXT,
    "published_at" TIMESTAMPTZ(6),
    "source_updated_at" TIMESTAMPTZ(6),
    "retrieved_at" TIMESTAMPTZ(6) NOT NULL,
    "ingestion_method" TEXT NOT NULL,
    "processing_status" TEXT NOT NULL DEFAULT 'stored',
    "extraction_status" TEXT NOT NULL DEFAULT 'not_started',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "documents_source_id_retrieved_at_idx" ON "documents"("source_id", "retrieved_at");

-- CreateIndex
CREATE INDEX "documents_created_at_id_idx" ON "documents"("created_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "documents_source_id_canonical_url_content_hash_key" ON "documents"("source_id", "canonical_url", "content_hash");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE public.documents ADD CONSTRAINT documents_hash_check CHECK (
  content_hash ~ '^[0-9a-f]{64}$' AND metadata_hash ~ '^[0-9a-f]{64}$' AND hash_method = 'sha256-raw-v1'
);
ALTER TABLE public.documents ADD CONSTRAINT documents_type_check CHECK (document_type IN ('webpage', 'pdf', 'text', 'unknown'));
ALTER TABLE public.documents ADD CONSTRAINT documents_method_check CHECK (ingestion_method IN ('manual', 'crawler'));
ALTER TABLE public.documents ADD CONSTRAINT documents_text_check CHECK ((title IS NULL OR length(title) <= 300) AND (excerpt IS NULL OR length(excerpt) <= 500));
ALTER TABLE public.documents ADD CONSTRAINT documents_url_check CHECK (length(canonical_url) <= 2048 AND canonical_url ~ '^https?://[^/[:space:]@#]+([/?][^[:space:]#]*)?$');
ALTER TABLE public.documents ADD CONSTRAINT documents_dates_check CHECK ((published_at IS NULL OR published_at <= retrieved_at) AND (source_updated_at IS NULL OR source_updated_at <= retrieved_at));
-- Slice 3 stores metadata only. Later processing requires an explicit migration;
-- callers cannot mark content verified or claim extraction has run.
ALTER TABLE public.documents ADD CONSTRAINT documents_status_check CHECK (processing_status = 'stored' AND extraction_status = 'not_started');

-- Dedicated non-login role, never granted to anon/authenticated. The migration
-- owner is the server connection identity and may switch to this bounded role.
CREATE ROLE nordic_ingestor NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT;
DO $$ BEGIN EXECUTE format('GRANT nordic_ingestor TO %I', current_user); END $$;
GRANT USAGE ON SCHEMA public TO nordic_ingestor;
GRANT SELECT ON public.sources TO nordic_ingestor;
CREATE POLICY sources_ingestor_read ON public.sources FOR SELECT TO nordic_ingestor USING (true);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.documents FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.documents TO anon, authenticated, nordic_ingestor;
GRANT INSERT ON public.documents TO nordic_ingestor;
CREATE POLICY documents_public_read ON public.documents FOR SELECT TO anon, authenticated, nordic_ingestor USING (true);
CREATE POLICY documents_internal_insert ON public.documents FOR INSERT TO nordic_ingestor WITH CHECK (processing_status = 'stored' AND extraction_status = 'not_started');
-- No document seeds: fixtures belong exclusively in tests.

COMMIT;
