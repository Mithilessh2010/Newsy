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
