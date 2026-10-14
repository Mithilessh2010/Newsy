# Equal Horizons Worldwide — v3.0 Reliability & Security Update

**Please read this before deploying.** This is a full-stack source repository, **not a verified live public website**. It includes 24/7 scheduled-ingestion logic and a worldwide news frontend, but those features need deployment, a working Supabase project, and the scheduler. No developer can guarantee zero bugs or worldwide news completeness. Current verification is recorded in `QA_REPORT.md`.

**New in v3.0**

- Local, national, and world news feeds now have their **own archival queues**. Worldwide and national data is no longer only transient.
- Stable source IDs are shared by live and archived stories; results deduplicate by original URL.
- The SQL `reliability.sql` migration adds atomic polling leases (`FOR UPDATE SKIP LOCKED`), queue automation when readers follow cities, and personal bookmark metadata.
- Cross-device saved headline metadata restores after sign-in. Logout clears local saved data. Owner-only UPDATE policies allow authenticated upserts.
- `/api/health` reports whether the database is connected and the worldwide ingestion job has run successfully in the last 45 minutes.
- `/scripts/smoke.mjs` checks a real hosted app; GitHub Actions `ci.yml` installs dependencies, audits high-severity production vulnerabilities, runs tests and types, and performs a Next.js production build.
- Next.js is pinned to `15.5.27`, React/React DOM to `19.3.0`, with security headers applied through `next.config.ts`.

## Production launch order

1. Add this directory to a **new** GitHub repository and connect that repository to a **new** Vercel project. Do **not** overwrite your existing Equal Horizons or other portfolio projects.
2. With npm network access: run `npm install`, `npm test`, `npm run typecheck`, and `npm run build`. Generate and commit `package-lock.json`, then switch CI to `npm ci` for reproducibility.
3. Create an independent Supabase project. Run SQL **in this order**: `sql/schema.sql`, `sql/worldwide.sql`, and **`sql/reliability.sql`**. `sql/optional-search-index.sql` can be run afterward for a large archive.
4. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `CRON_SECRET` as **Vercel environment variables**. Never put the latter two in `NEXT_PUBLIC_*` keys or a source repository.
5. Enable email OTP and set allowed Supabase redirect URLs for `/account` both locally and on your live domain.
6. Deploy to a preview domain. Run `BASE_URL=https://your-preview-url npm run smoke`. In a protected preview, authorize the testing client using the approved Vercel bypass approach.
7. Configure Supabase Vault secrets and the recurring 15-minute scheduler from `sql/supabase_scheduler_example.sql`. Vercel Hobby's native cron runs only daily, so it is not the primary scheduler here.
8. After the scheduler has run, confirm `/api/health` reports `operational`; also confirm active poll results and failed jobs in Supabase. Run `BASE_URL=https://your-site REQUIRE_LIVE_FEED=1 REQUIRE_INGESTION=1 npm run smoke` to require actual provider availability and ingestion.
9. Turn on uptime alerts and logs; monitor feed failures and vendor terms before a public launch.

The included worker checks **up to 8 local city feeds and 4 national/worldwide feeds per run**, selected fairly from database queues. With a 15-minute trigger, that is a potential 48 queue slots/hour—not 48 unique cities guaranteed, and not full global archival coverage. Refresh intervals vary with the number of locations, provider availability, and hosting budgets. Official documents must be integrated jurisdiction by jurisdiction. The archive starts accumulating **only after database+ingestion activation**; this app does not own the entire historical news record of the world.

---

# Equal Horizons Civic — Worldwide News + Public Knowledge

A genuine Next.js 15 + TypeScript full-stack codebase. A custom cobalt-blue editorial UI; geographic editions; live source headlines; source directories; followed communities; PostgreSQL archive; round-robin ingestion worker. Designed to start small and expand safely.

**Current status:** Implemented, syntax-checked, and tested at the source level. **Not yet deployed or verified in a full Next.js production build** from this container (npm registry connection unavailable). Background 24/7 scheduling and accounts require the owner's Supabase, credentials and a deployed URL. No claim of universal government record indexing.

## Quickstart

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. Without Supabase, location search and recent regional publisher headlines can still be requested; saved preferences remain in the browser; ingestion history and real accounts are unavailable. An upstream news service may block feeds, rate-limit requests or change formats.

## Included features

- Worldwide city chooser via Open-Meteo geocoding: search by name, choose city/region/country. Country-aware regional editions; examples across six continents.
- Optional approximate city detection using Vercel geo headers. If available, a guess is displayed. Browser GPS is **opt-in only** and calls BigDataCloud's *client-side* reverse-geocoding endpoint directly with fresh consented coordinates. Do not proxy, batch, or reuse coordinates with the free endpoint. It sees request IP and coordinates; communicate this privacy tradeoff to users.
- Local / National / World news switcher. Google News RSS search links to publisher headlines, plus an official Pleasanton municipal feed when relevant. Supports worldwide region-specific RSS editions; local coverage depends on publisher availability. The interface does not claim 24-hour complete news coverage.
- Country-specific starting links to national open government data portals for selected countries, and World Bank's international Data Catalog. Detailed manually indexed municipal records/timelines currently cover Pleasanton only; all other cities explicitly indicate local records are still being added. No invented citations or public-record details.
- Search recent headlines and indexed archived headline metadata; account-dependent saved items and followed topics; source-backed story detail.
- Protected server-side ingestion worker that archives selected city headlines into Supabase Postgres. It polls at most 8 cities per run (the least recently checked), and reads subscribed cities from `followed_locations`.

## Required environment variables

See `.env.example`. Set in local `.env.local` and your hosted environment:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOURPROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLIC_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_PRIVATE_SERVER_SIDE_KEY
CRON_SECRET=YOUR_LONG_RANDOM_SECRET
```

Never commit secrets or embed `SUPABASE_SERVICE_ROLE_KEY` / `CRON_SECRET` in browser components.

## Database steps

1. Create a Supabase project.
2. Execute `sql/schema.sql` in the SQL editor.
3. Execute `sql/worldwide.sql`, then `sql/reliability.sql` (migrations). This creates geography fields and the polling queue. SQL uses RLS to protect users' saves and subscribed cities; ingestion tables are service-role only.
4. Set Supabase email authentication redirect URLs in project settings for `https://YOURDOMAIN/account` (plus local dev). Anonymous browsing requires no account; global monitored-city inclusion requires sign-in.
5. Add env keys to Vercel and deploy the Next.js repository.

### Continuous ingestion — important plan limits

A Vercel Hobby deployment can run its built-in `vercel.json` cron **only once a day**, so the included daily cron is just a fallback. This project *does not* claim that daily cron is 24/7 polling. For a 15-minute cadence around the clock, set up **Supabase Cron + pg_net** using `sql/supabase_scheduler_example.sql`. Read that file first; configure two Vault secrets: `eh_app_url` (your published URL) and `eh_cron_secret` (same secret as Vercel's CRON_SECRET). Each run calls `GET /api/cron/ingest` with `Authorization: Bearer ...`.

```sql
-- After configuring Supabase Vault, see sql/supabase_scheduler_example.sql
select jobname,schedule,active from cron.job where jobname='equal-horizons-world-ingest';
```

Each run polls rotating batches, NOT every city in the world. With 8 local city feeds plus 4 national/world queue feeds per 15-minute batch, approximately 32 local-city slots and 16 wider-feed slots per hour can be refreshed subject to feed, database, timeouts and hosting budgets. As users subscribe to more cities, the effective per-city frequency will decrease; scale horizontally with queue workers and provider contracts when usage demands it. Supabase jobs don't magically make news breaking: publisher publication timing and upstream RSS caches remain outside the app's control. Respect provider terms, and avoid copying full articles without permission.

Vercel official limits: https://vercel.com/docs/cron-jobs/usage-and-pricing
Supabase scheduling: https://supabase.com/docs/guides/functions/schedule-functions

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Editorial home |
| `/news` | City / country / world wire |
| `/explore` | Global city discovery and topics |
| `/records` | Curated official source index |
| `/timelines` | Verified timeline directory (pilot data) |
| `/search` | Search current and archived headlines and source directories |
| `/stories/[id]` | Source-focused story details |
| `/account`, `/saved` | Accounts, saved reading and topics |
| `/api/locations/search?q=Paris` | City lookup, rate-cached |
| `/api/locations/detect` | Approximate deployment IP headers (not precise GPS) |
| `/api/news?city=Tokyo&region=Tokyo&country=JP&scope=local` | Recent and archived headlines |
| `/api/search?q=rail&city=London&region=England&country=GB&scope=local` | Regional index search |
| `/api/cron/ingest` | Secret-guarded background archival worker |

## Verification

```bash
npm test
npm run typecheck
npm run build
```

28 unit/mock integration and security checks passed in this environment (see QA report). A true production build, genuine provider fetch tests, hosted account sign-in, and real database migrations remain unverified until deployment with credentials. This deliverable includes no hosted data ingestion and no API credentials. Do not publicly announce the background archive as operational until the database migration, scheduler, source licenses, privacy notice, logs, and production build have been verified.

## How to scale beyond RSS

RSS headlines alone won't cover all municipal records. Add jurisdiction-specific connectors behind an approved source registry, checking legal access and licensing. For public documents, save *metadata and source URLs* first; only index full text where permitted and after OCR/quality checks. Use entity resolution, multilingual search, source provenance, correction handling, deduplication, user rate limits, moderation, anti-abuse and search pagination. Scale per-city monitoring queues based on active users, and separately index global/government data feeds. A worldwide historical public-record repository is a multi-phase ingestion project, not a one-API feature.

## Security and user trust

- GPS access is explicitly initiated by the user and precise GPS is not stored in Equal Horizons' database or localStorage. BigDataCloud receives the GPS coordinate/IP signal when the user chooses that option; disclose this in a public privacy policy.
- IP-based location inference may be wrong, especially on a VPN, mobile provider or shared office network; manual override remains available.
- Always attribute and link original publishers and government sources.
- RSS availability may vary by locale; cached headlines are not the same as an authenticated breaking-news alert system.
- Use production abuse-prevention/rate limiting, privacy disclosures, observability and source-provider contracts before a high-traffic launch.

© Equal Horizons. Editorial concept and application implementation.
