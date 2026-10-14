-- Optional performance index for large news archives.
-- Requires pg_trgm; run separately AFTER the core schema migrations.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS news_title_trgm ON public.news_items USING gin (title gin_trgm_ops);
