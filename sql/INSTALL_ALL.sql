create table if not exists public.saved_items (
 user_id uuid not null references auth.users(id) on delete cascade,
 item_id text not null,
 created_at timestamptz not null default now(),
 primary key(user_id,item_id)
);
create table if not exists public.followed_topics (
 user_id uuid not null references auth.users(id) on delete cascade,
 topic_id text not null,
 created_at timestamptz not null default now(),
 primary key(user_id,topic_id)
);
create table if not exists public.news_items (
 id text primary key,
 title text not null,
 publisher text not null,
 url text not null,
 published_at timestamptz not null,
 category text not null,
 city text not null,
 first_seen_at timestamptz not null default now(),
 last_seen_at timestamptz not null default now()
);
create index if not exists news_city_date on public.news_items(city,published_at desc);
create index if not exists news_title_search on public.news_items using gin (to_tsvector('english',title));
alter table public.saved_items enable row level security;
alter table public.followed_topics enable row level security;
alter table public.news_items enable row level security;
drop policy if exists "saved_owner_select" on public.saved_items;
drop policy if exists "saved_owner_insert" on public.saved_items;
drop policy if exists "saved_owner_delete" on public.saved_items;
create policy "saved_owner_select" on public.saved_items for select to authenticated using ((select auth.uid())=user_id);
create policy "saved_owner_insert" on public.saved_items for insert to authenticated with check ((select auth.uid())=user_id);
create policy "saved_owner_delete" on public.saved_items for delete to authenticated using ((select auth.uid())=user_id);
drop policy if exists "follow_owner_select" on public.followed_topics;
drop policy if exists "follow_owner_insert" on public.followed_topics;
drop policy if exists "follow_owner_delete" on public.followed_topics;
create policy "follow_owner_select" on public.followed_topics for select to authenticated using ((select auth.uid())=user_id);
create policy "follow_owner_insert" on public.followed_topics for insert to authenticated with check ((select auth.uid())=user_id);
create policy "follow_owner_delete" on public.followed_topics for delete to authenticated using ((select auth.uid())=user_id);
drop policy if exists "public_news_select" on public.news_items;
create policy "public_news_select" on public.news_items for select to anon, authenticated using (true);
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
BEGIN;
ALTER TABLE public.saved_items ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
DROP POLICY IF EXISTS "saved_owner_update" ON public.saved_items;
CREATE POLICY "saved_owner_update" ON public.saved_items FOR UPDATE TO authenticated
 USING ((select auth.uid())=user_id) WITH CHECK ((select auth.uid())=user_id);
DROP POLICY IF EXISTS "follow_owner_update" ON public.followed_topics;
CREATE POLICY "follow_owner_update" ON public.followed_topics FOR UPDATE TO authenticated
 USING ((select auth.uid())=user_id) WITH CHECK ((select auth.uid())=user_id);
DROP POLICY IF EXISTS "location_owner_update" ON public.followed_locations;
CREATE POLICY "location_owner_update" ON public.followed_locations FOR UPDATE TO authenticated
 USING ((select auth.uid())=user_id) WITH CHECK ((select auth.uid())=user_id);
ALTER TABLE public.monitored_locations ADD COLUMN IF NOT EXISTS lease_until timestamptz;
CREATE TABLE IF NOT EXISTS public.monitored_feeds (
 feed_key text PRIMARY KEY,
 scope text NOT NULL CHECK(scope IN ('national','world')),
 city text NOT NULL,
 region text NOT NULL DEFAULT '',
 country_code text NOT NULL,
 last_checked_at timestamptz,
 lease_until timestamptz,
 last_status text,
 last_count integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS monitored_feeds_poll_order ON public.monitored_feeds(last_checked_at ASC NULLS FIRST);
ALTER TABLE public.monitored_feeds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.monitored_feeds FROM anon,authenticated;
INSERT INTO public.monitored_feeds(feed_key,scope,city,region,country_code)
VALUES ('world','world','Worldwide','','US') ON CONFLICT DO NOTHING;
CREATE OR REPLACE FUNCTION public.register_followed_location() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 INSERT INTO public.monitored_locations(location_key,city,region,country_code)
 VALUES (NEW.location_key,NEW.city,NEW.region,NEW.country_code)
 ON CONFLICT (location_key) DO NOTHING;
 INSERT INTO public.monitored_feeds(feed_key,scope,city,region,country_code)
 VALUES ('national:'||NEW.country_code,'national',NEW.city,NEW.region,NEW.country_code)
 ON CONFLICT (feed_key) DO NOTHING;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.register_followed_location() FROM PUBLIC;
DROP TRIGGER IF EXISTS followed_location_queue ON public.followed_locations;
CREATE TRIGGER followed_location_queue AFTER INSERT ON public.followed_locations
FOR EACH ROW EXECUTE FUNCTION public.register_followed_location();
INSERT INTO public.monitored_locations(location_key,city,region,country_code)
 SELECT DISTINCT ON (location_key) location_key,city,region,country_code FROM public.followed_locations WHERE true
 ON CONFLICT (location_key) DO NOTHING;
INSERT INTO public.monitored_feeds(feed_key,scope,city,region,country_code)
 SELECT DISTINCT ON (country_code) 'national:'||country_code,'national',city,region,country_code
 FROM public.followed_locations WHERE true ON CONFLICT (feed_key) DO NOTHING;
CREATE OR REPLACE FUNCTION public.claim_local_ingestion(p_limit integer DEFAULT 8)
RETURNS SETOF public.monitored_locations LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 WITH picks AS (
 SELECT location_key FROM public.monitored_locations
 WHERE lease_until IS NULL OR lease_until < now()
 ORDER BY last_checked_at ASC NULLS FIRST LIMIT least(greatest(p_limit,1),16) FOR UPDATE SKIP LOCKED
 )
 UPDATE public.monitored_locations m SET lease_until=now()+interval '2 minutes'
 FROM picks WHERE m.location_key=picks.location_key RETURNING m.*;
$$;
CREATE OR REPLACE FUNCTION public.claim_wide_ingestion(p_limit integer DEFAULT 4)
RETURNS SETOF public.monitored_feeds LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 WITH picks AS (
 SELECT feed_key FROM public.monitored_feeds
 WHERE lease_until IS NULL OR lease_until < now()
 ORDER BY last_checked_at ASC NULLS FIRST LIMIT least(greatest(p_limit,1),8) FOR UPDATE SKIP LOCKED
 )
 UPDATE public.monitored_feeds m SET lease_until=now()+interval '2 minutes'
 FROM picks WHERE m.feed_key=picks.feed_key RETURNING m.*;
$$;
REVOKE ALL ON FUNCTION public.claim_local_ingestion(integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.claim_wide_ingestion(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_local_ingestion(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_wide_ingestion(integer) TO service_role;
COMMIT;
CREATE TABLE IF NOT EXISTS public.global_items (
 id text PRIMARY KEY,source text NOT NULL,category text NOT NULL,
 title text NOT NULL,description text NOT NULL DEFAULT '',url text NOT NULL,
 published_at timestamptz NOT NULL, latitude double precision,longitude double precision,
 first_seen_at timestamptz NOT NULL DEFAULT now(),last_seen_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT global_lat_range CHECK(latitude IS NULL OR latitude BETWEEN -90 AND 90),
 CONSTRAINT global_lon_range CHECK(longitude IS NULL OR longitude BETWEEN -180 AND 180)
);
CREATE INDEX IF NOT EXISTS global_items_pubdate ON public.global_items(published_at DESC);
CREATE INDEX IF NOT EXISTS global_items_category_date ON public.global_items(category,published_at DESC);
CREATE INDEX IF NOT EXISTS global_items_title_search ON public.global_items USING GIN(to_tsvector('simple',title));
ALTER TABLE public.global_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS global_public_read ON public.global_items;
CREATE POLICY global_public_read ON public.global_items FOR SELECT TO anon,authenticated USING(true);
REVOKE INSERT, UPDATE, DELETE ON public.global_items FROM anon, authenticated;
CREATE TABLE IF NOT EXISTS public.source_runs (
 id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
 run_at timestamptz NOT NULL DEFAULT now(),source_ids text[] NOT NULL,
 records_seen integer NOT NULL,records_stored integer NOT NULL,
 failures text[] NOT NULL DEFAULT '{}',status text NOT NULL DEFAULT 'completed'
);
ALTER TABLE public.source_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.source_runs FROM anon,authenticated;
