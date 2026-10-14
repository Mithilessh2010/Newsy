-- Run AFTER sql/schema.sql. Maintains existing data and adds location-aware news archival.
ALTER TABLE public.news_items ADD COLUMN IF NOT EXISTS country_code text NOT NULL DEFAULT 'US';
ALTER TABLE public.news_items ADD COLUMN IF NOT EXISTS region text NOT NULL DEFAULT 'California';
ALTER TABLE public.news_items ADD COLUMN IF NOT EXISTS location_key text NOT NULL DEFAULT 'us-california-pleasanton';
ALTER TABLE public.news_items ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'local';
CREATE INDEX IF NOT EXISTS news_geo_date ON public.news_items(location_key,scope,published_at DESC);
CREATE TABLE IF NOT EXISTS public.followed_locations (
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 location_key text NOT NULL,
 city text NOT NULL,
 region text NOT NULL DEFAULT '',
 country_code text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,location_key),
 CONSTRAINT location_city_length CHECK(length(city) BETWEEN 2 AND 90),
 CONSTRAINT location_country_format CHECK(country_code ~ '^[A-Z]{2}$')
);
ALTER TABLE public.followed_locations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "location_owner_select" ON public.followed_locations;
DROP POLICY IF EXISTS "location_owner_insert" ON public.followed_locations;
DROP POLICY IF EXISTS "location_owner_delete" ON public.followed_locations;
CREATE POLICY "location_owner_select" ON public.followed_locations FOR SELECT TO authenticated USING ((select auth.uid())=user_id);
CREATE POLICY "location_owner_insert" ON public.followed_locations FOR INSERT TO authenticated WITH CHECK ((select auth.uid())=user_id);
CREATE POLICY "location_owner_delete" ON public.followed_locations FOR DELETE TO authenticated USING ((select auth.uid())=user_id);
-- Worker-only queue and polling telemetry. No browser access policies.
CREATE TABLE IF NOT EXISTS public.monitored_locations (
 location_key text PRIMARY KEY,
 city text NOT NULL,
 region text NOT NULL DEFAULT '',
 country_code text NOT NULL,
 last_checked_at timestamptz,
 last_status text,
 last_count integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS monitored_queue ON public.monitored_locations(last_checked_at ASC NULLS FIRST);
ALTER TABLE public.monitored_locations ENABLE ROW LEVEL SECURITY;
-- Deliberately no public INSERT/SELECT/UPDATE/DELETE policies. Worker uses service-role.
