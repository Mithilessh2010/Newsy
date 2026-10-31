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
