-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "countries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "iso_code" TEXT,
    "region" TEXT,
    "status" TEXT NOT NULL DEFAULT 'needs_research',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "countries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sources" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "canonical_url" TEXT NOT NULL,
    "country_id" UUID,
    "source_tier" TEXT,
    "source_type" TEXT,
    "topics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "language" TEXT,
    "authority_notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'needs_verification',
    "crawl_enabled" BOOLEAN NOT NULL DEFAULT false,
    "crawl_frequency" TEXT,
    "crawl_policy" TEXT NOT NULL DEFAULT 'not_reviewed',
    "last_crawled_at" TIMESTAMPTZ(6),
    "last_verified_at" TIMESTAMPTZ(6),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "countries_slug_key" ON "countries"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "countries_name_key" ON "countries"("name");

-- CreateIndex
CREATE UNIQUE INDEX "countries_iso_code_key" ON "countries"("iso_code");

-- CreateIndex
CREATE UNIQUE INDEX "sources_canonical_url_key" ON "sources"("canonical_url");

-- CreateIndex
CREATE INDEX "sources_country_id_idx" ON "sources"("country_id");

-- CreateIndex
CREATE INDEX "sources_source_tier_status_idx" ON "sources"("source_tier", "status");

-- AddForeignKey
ALTER TABLE "sources" ADD CONSTRAINT "sources_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Database constraints also protect writes outside Prisma.
ALTER TABLE public.countries ADD CONSTRAINT countries_status_check CHECK (status IN ('needs_research', 'active', 'archived'));
ALTER TABLE public.sources ADD CONSTRAINT sources_tier_check CHECK (source_tier IN ('T1', 'T2', 'T3', 'T4'));
ALTER TABLE public.sources ADD CONSTRAINT sources_status_check CHECK (status IN ('needs_verification', 'verified', 'review_required'));
ALTER TABLE public.sources ADD CONSTRAINT sources_policy_check CHECK (crawl_policy IN ('not_reviewed', 'approved', 'blocked'));
ALTER TABLE public.sources ADD CONSTRAINT sources_url_check CHECK (canonical_url ~ '^https?://[^/[:space:]@#]+([/?][^[:space:]#]*)?$');
ALTER TABLE public.sources ADD CONSTRAINT sources_review_check CHECK (status <> 'verified' OR (last_verified_at IS NOT NULL AND authority_notes IS NOT NULL AND length(trim(authority_notes)) > 0));
ALTER TABLE public.sources ADD CONSTRAINT sources_crawl_check CHECK (NOT crawl_enabled OR (crawl_policy = 'approved' AND status = 'verified'));

-- Both roles may read public registry metadata. Neither may modify it.
ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.countries, public.sources FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.countries, public.sources TO anon, authenticated;
CREATE POLICY countries_public_read ON public.countries FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY sources_public_read ON public.sources FOR SELECT TO anon, authenticated USING (true);

-- Seed only product scope and URLs explicitly supplied by PROJECT_SPEC.md.
-- Registration time is not retrieval or verification time.
INSERT INTO public.countries (slug, name) VALUES
('sweden', 'Sweden'), ('denmark', 'Denmark'), ('finland', 'Finland'),
('norway', 'Norway'), ('netherlands', 'Netherlands');
INSERT INTO public.sources (name, canonical_url, notes) VALUES
('EURES', 'https://eures.europa.eu/index_en', 'Seed supplied in PROJECT_SPEC.md. Candidate for employment research; authority and country coverage have not been reviewed.'),
('Hotcourses Europe', 'https://www.hotcourses.vn/europe/', 'Seed supplied in PROJECT_SPEC.md for education discovery. Authority and country coverage have not been reviewed.');
