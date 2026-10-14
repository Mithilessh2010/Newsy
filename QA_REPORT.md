# Equal Horizons Worldwide v3.0 — Verification Report

**Report date:** October 14, 2026.  **Disposition: NOT production-certified.**

## Tests that passed here

- **28/28 automated tests** using Node's built-in test runner: location normalization, RSS validation and scheme filtering, feed outage handling, international source queries, stable article IDs, archival-row composition, source URL deduplication, protected cron authentication, simulated local/national/world ingestion, lease release on provider failure, simulated DB-backed news merge, health endpoint status, account metadata and RLS policy checks, route presence, and client-secret scans.
- All TypeScript/TSX files passed transpilation syntax checks (full static typecheck is a separate step).
- Inspected `.env.example` for exposed secrets; no credentials were inserted.
- Hosting limits and scheduler approach checked against current Vercel and Supabase documentation.

## What was not possible to verify here

- `npm install`, `npm run typecheck`, `npm run build`, and `npm audit` against installed dependencies: this container cannot resolve `registry.npmjs.org`, and Next.js/React packages are not cached.
- Live upstream data feeds, real geocoding, publisher rate limits or licensing under load: the isolated code runtime has no outbound internet access. RSS and ingestion tests use simulated upstream responses.
- Real Supabase database migrations, row-level policy behavior, email OTP deliverability and bookmarks syncing across two physical devices: no project URL/service credentials are connected.
- Hourly/24-hour recurring execution, exact provider freshness and production uptime: deployment and scheduling are not activated.
- Full-browser pixel or interaction regression with a production Next.js build: runtime dependencies and a deployed URL are unavailable.

## Production acceptance checklist

- [ ] Install dependencies using a trusted online environment and commit the generated `package-lock.json`.
- [ ] CI tests, static TypeScript check, dependency audit, and **Next.js production build** all pass.
- [ ] Run all three database migrations in the required order (then optional index).
- [ ] Validate RLS with two separate authenticated users, including saved-item upsert, delete, and cross-user isolation.
- [ ] Complete an email magic-link sign-in and sign-out in a real browser on an allowed redirect URL.
- [ ] Verify four international cities and at least three country editions with original publisher links.
- [ ] Test world and national archival writes against a real Supabase database.
- [ ] Activate Supabase Cron + Vault and verify at least 24 hours of scheduled polls, status logs and recovery from feed errors.
- [ ] Confirm `/api/health` returns `operational` after scheduled runs and alerts fire when it becomes degraded.
- [ ] Run strict smoke checks against the deployed preview: `REQUIRE_LIVE_FEED=1 REQUIRE_INGESTION=1 npm run smoke`.
- [ ] Establish privacy terms, vendor permissions, rate limits and monitoring before widespread usage.

**Important product limitation:** this is a continuously growing archive of *collected publisher headlines and official-source links*, not comprehensive historical coverage of every city, news organization, and public document in the world. Live/official availability varies by jurisdiction. Do not represent it otherwise to readers.
