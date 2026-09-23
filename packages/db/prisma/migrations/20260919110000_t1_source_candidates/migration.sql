BEGIN;

-- Closes part of the Section 18 gap noted in PROJECT_SPEC.md: the two
-- PROJECT_SPEC seed sources (EURES, Hotcourses) are not enough coverage for
-- 5 countries x 4 topic areas. These 15 rows are the per-country T1
-- checklist PROJECT_SPEC.md asked for (immigration/residence authority,
-- national statistics/labour agency, primary official study-in-<country>
-- portal), researched via live web search on 2026-09-19 -- not guessed from
-- a naming convention (AGENTS.md Section 1.2).
--
-- Deliberately conservative, per AGENTS.md Section 1.2/1.3/9:
--   - status stays 'needs_verification', never 'verified'. Verifying a
--     source means a human operator confirms its authority and records
--     that in authority_notes + last_verified_at (see save_source in
--     20260919100000_sources_manage); an AI compiling search results is not
--     that confirmation.
--   - crawl_policy stays 'not_reviewed' and crawl_enabled stays false. Robots.txt,
--     rate limits and terms of service have not been reviewed for any of
--     these domains (AGENTS.md Section 6); that review is a separate,
--     human, per-source decision.
--   - source_tier T1 is assigned only where authority_notes below documents
--     a specific government-agency/ministry link found in search results.
--     Nuffic (Netherlands study portal) is government-*funded* but an
--     independent non-profit, not a ministry/agency -- tier T2, not T1.
--
-- Country-topic combinations still missing after this migration (education
-- portals for DK/FI/NO/NL beyond the general study-in-X sites, and any
-- cost-of-living/housing/healthcare source for all 5 countries) are not
-- addressed here and must not be inferred from these rows.

INSERT INTO public.sources (name, canonical_url, country_id, source_tier, source_type, topics, language, authority_notes, notes) VALUES
('Migrationsverket (Swedish Migration Agency)', 'https://www.migrationsverket.se/en.html',
 (SELECT id FROM public.countries WHERE slug = 'sweden'), 'T1', 'immigration_authority', ARRAY['immigration'], 'en',
 'Swedish government agency; decides on residence/work/study permits and citizenship. Confirmed via web search 2026-09-19, not independently cross-checked against a primary legal register.',
 'Candidate T1 source for Slice 2/3 (PROJECT_SPEC Section 18 gap). Registered by an AI research pass; needs human verification before status=verified or crawl_enabled=true.'),
('Statistics Sweden (SCB) - Labour market', 'https://www.scb.se/en/finding-statistics/statistics-by-subject-area/labour-market/',
 (SELECT id FROM public.countries WHERE slug = 'sweden'), 'T1', 'statistics_agency', ARRAY['labour_market'], 'en',
 'Swedish government statistics agency under the Ministry of Finance. Confirmed via web search 2026-09-19.',
 'Candidate T1 source for Slice 2/3 (PROJECT_SPEC Section 18 gap). Registered by an AI research pass; needs human verification before status=verified or crawl_enabled=true.'),
('Study in Sweden', 'https://studyinsweden.se/',
 (SELECT id FROM public.countries WHERE slug = 'sweden'), 'T1', 'study_portal', ARRAY['education'], 'en',
 'Built and maintained by the Swedish Institute (Svenska institutet), a Swedish government agency. Confirmed via web search 2026-09-19.',
 'Candidate T1 source for Slice 2/3 (PROJECT_SPEC Section 18 gap). Registered by an AI research pass; needs human verification before status=verified or crawl_enabled=true.'),

('SIRI (Danish Agency for International Recruitment and Integration)', 'https://siri.dk/english/',
 (SELECT id FROM public.countries WHERE slug = 'denmark'), 'T1', 'immigration_authority', ARRAY['immigration'], 'en',
 'Danish government agency under the Ministry of Immigration and Integration; issues residence/work/study permits. Spot-verified by fetching the page on 2026-09-19: it states "SIRI is an agency under the Danish Ministry of Immigration and Integration."',
 'Handles work/study permits specifically; family reunification and asylum are handled by the separate Danish Immigration Service (newtodenmark.dk / nyidanmark.dk) -- not registered here, add separately if needed. Candidate T1 source for Slice 2/3 (PROJECT_SPEC Section 18 gap); needs human verification before status=verified or crawl_enabled=true.'),
('Statistics Denmark (Danmarks Statistik)', 'https://www.dst.dk/en',
 (SELECT id FROM public.countries WHERE slug = 'denmark'), 'T1', 'statistics_agency', ARRAY['labour_market'], 'en',
 'Danish government statistics agency under the Ministry of Digital Affairs. Confirmed via web search 2026-09-19.',
 'Candidate T1 source for Slice 2/3 (PROJECT_SPEC Section 18 gap). Registered by an AI research pass; needs human verification before status=verified or crawl_enabled=true.'),
('Study in Denmark', 'https://studyindenmark.dk/',
 (SELECT id FROM public.countries WHERE slug = 'denmark'), 'T1', 'study_portal', ARRAY['education'], 'en',
 'Managed by the Danish Ministry of Higher Education and Science. Confirmed via web search 2026-09-19.',
 'Candidate T1 source for Slice 2/3 (PROJECT_SPEC Section 18 gap). Registered by an AI research pass; needs human verification before status=verified or crawl_enabled=true.'),

('Finnish Immigration Service (Migri)', 'https://migri.fi/en/home',
 (SELECT id FROM public.countries WHERE slug = 'finland'), 'T1', 'immigration_authority', ARRAY['immigration'], 'en',
 'Finnish government agency under the Ministry of the Interior; decides on residence permits and citizenship. Confirmed via web search 2026-09-19.',
 'Candidate T1 source for Slice 2/3 (PROJECT_SPEC Section 18 gap). Registered by an AI research pass; needs human verification before status=verified or crawl_enabled=true.'),
('Statistics Finland (Tilastokeskus)', 'https://stat.fi/en',
 (SELECT id FROM public.countries WHERE slug = 'finland'), 'T1', 'statistics_agency', ARRAY['labour_market'], 'en',
 'Finnish national statistical institution. Confirmed via web search 2026-09-19.',
 'Candidate T1 source for Slice 2/3 (PROJECT_SPEC Section 18 gap). Registered by an AI research pass; needs human verification before status=verified or crawl_enabled=true.'),
('Studyinfo (Opintopolku)', 'https://opintopolku.fi/konfo/en/',
 (SELECT id FROM public.countries WHERE slug = 'finland'), 'T1', 'study_portal', ARRAY['education'], 'en',
 'Official application portal for Finnish degree programmes, maintained by the Finnish National Agency for Education (EDUFI/Opetushallitus), a government agency. Confirmed via web search 2026-09-19; page content could not be independently re-fetched (JS-rendered app).',
 'Candidate T1 source for Slice 2/3 (PROJECT_SPEC Section 18 gap). Registered by an AI research pass; needs human verification before status=verified or crawl_enabled=true.'),

('UDI (Norwegian Directorate of Immigration)', 'https://www.udi.no/en/',
 (SELECT id FROM public.countries WHERE slug = 'norway'), 'T1', 'immigration_authority', ARRAY['immigration'], 'en',
 'Norwegian government agency under the Ministry of Justice and Public Security; processes asylum, residence and work permit applications. Confirmed via web search 2026-09-19.',
 'Candidate T1 source for Slice 2/3 (PROJECT_SPEC Section 18 gap). Registered by an AI research pass; needs human verification before status=verified or crawl_enabled=true.'),
('Statistics Norway (SSB)', 'https://www.ssb.no/en',
 (SELECT id FROM public.countries WHERE slug = 'norway'), 'T1', 'statistics_agency', ARRAY['labour_market'], 'en',
 'Norwegian government statistics bureau. Confirmed via web search 2026-09-19.',
 'Candidate T1 source for Slice 2/3 (PROJECT_SPEC Section 18 gap). Registered by an AI research pass; needs human verification before status=verified or crawl_enabled=true.'),
('Study in Norway', 'https://studyinnorway.no/',
 (SELECT id FROM public.countries WHERE slug = 'norway'), 'T1', 'study_portal', ARRAY['education'], 'en',
 'Provided by the Norwegian Directorate for Higher Education and Skills (HK-dir), a government agency. Confirmed via web search 2026-09-19.',
 'Candidate T1 source for Slice 2/3 (PROJECT_SPEC Section 18 gap). Registered by an AI research pass; needs human verification before status=verified or crawl_enabled=true.'),

('IND (Immigration and Naturalisation Service)', 'https://ind.nl/en',
 (SELECT id FROM public.countries WHERE slug = 'netherlands'), 'T1', 'immigration_authority', ARRAY['immigration'], 'en',
 'Dutch government agency, part of the Ministry of Justice and Security; processes residence permits, visas and naturalisation. Confirmed via web search 2026-09-19.',
 'Candidate T1 source for Slice 2/3 (PROJECT_SPEC Section 18 gap). Registered by an AI research pass; needs human verification before status=verified or crawl_enabled=true.'),
('CBS (Statistics Netherlands)', 'https://www.cbs.nl/en-gb',
 (SELECT id FROM public.countries WHERE slug = 'netherlands'), 'T1', 'statistics_agency', ARRAY['labour_market'], 'en',
 'Dutch government statistics agency (Centraal Bureau voor de Statistiek). Confirmed via web search 2026-09-19.',
 'Candidate T1 source for Slice 2/3 (PROJECT_SPEC Section 18 gap). Registered by an AI research pass; needs human verification before status=verified or crawl_enabled=true.'),
('Study in NL', 'https://www.studyinnl.org/',
 (SELECT id FROM public.countries WHERE slug = 'netherlands'), 'T2', 'study_portal', ARRAY['education'], 'en',
 'Run by Nuffic, a Dutch-government-funded but organisationally independent non-profit -- not a ministry or agency, so classified T2 rather than T1. Confirmed via web search 2026-09-19.',
 'Candidate source for Slice 2/3 (PROJECT_SPEC Section 18 gap). Registered by an AI research pass; needs human verification before status=verified or crawl_enabled=true.');

COMMIT;
