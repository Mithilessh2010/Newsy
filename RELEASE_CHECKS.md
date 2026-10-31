# Release checks — Newsy 1.5

This is a record of checks performed in the build workspace, not a claim of production readiness.

## Verified

- `npm test`: 90/90 passing, including adapter normalization, records source selection, invalid payloads, Canvas globe controls and SQL authorization rules.
- `npm run syntaxcheck`: 57 TypeScript/TSX source files parsed successfully.
- Playwright in Chromium without WebGL: the demo Earth rendered on desktop and mobile; location selection changed the camera; zoom responded; no page errors or horizontal overflow occurred.
- The 3 government keys shared during development were not included in source or output files.
- One CI workflow handles app verification and the separate browser job.

## Still to verify on deployment

- Node dependencies, the full TypeScript check and the production Next.js build. Registry access fails with `EAI_AGAIN` in this workspace, so a validated lockfile could not be generated.
- Live upstream availability, rate limits, provider schemas and ingestion scheduling.
- Hardware WebGL: test in a normal browser. The headless browser here could not initialize a WebGL context.
- Supabase authentication and archive persistence with real project credentials.
- A publicly reachable Vercel deployment and external smoke tests.

To finish: run `npm install`, commit the resulting `package-lock.json`, run `npm run typecheck && npm test && npm run build`, switch CI to `npm ci`, configure Vercel and Supabase, then test the deployed site.

## Authorship

The development of this project involved substantial AI assistance. Passing tests is evidence of behavior, not proof of human-written code. No credible under-30% AI-authorship percentage has been established. Represent contributions accurately for any program with limits on generated code.
