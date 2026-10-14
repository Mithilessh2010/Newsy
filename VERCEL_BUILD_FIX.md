# Vercel build fix — October 14, 2026

## Issue

Production deployment `9U4umEx76` of `Mithilessh2010/Newsy` failed in the Next.js TypeScript validation phase:

`app/api/search/route.ts:7:122` — `Argument of type 'string' is not assignable to parameter of type 'NewsScope'`.

## Fixed

In `app/api/search/route.ts`, the `scope` expression now narrows the same variable:

```ts
const loc = locationFromQuery(params);
const rawScope = params.get('scope');
const scope = isNewsScope(rawScope) ? rawScope : 'local';
```

This follows the already-correct pattern used by `app/api/news/route.ts`.

## Deploy

Preferred minimal fix: edit `app/api/search/route.ts` in the GitHub `Mithilessh2010/Newsy` `main` branch. Replace the old `const loc=...scope=...` expression with the above three lines. Commit the change; Vercel should deploy from GitHub automatically.

Alternative: replace repository contents with the included updated Next.js project, preserving your own protected environment variables in Vercel (never put credentials in git).

## Tests performed

- 29 Node.js automated tests passed on this updated source.
- Focused TypeScript proof that the guarded `scope` value is assignable to `NewsScope` passed with `tsc`.
- ZIP integrity is checked.

## Limitations

The full Next.js production build could **not** be run in the local build environment because npm dependency installation from the registry timed out. A successful Vercel build has **not** been observed for this patch. If Vercel reports another TypeScript/build error after redeployment, copy the new log so it can be fixed. Supabase environment variables and database migrations are still needed for full backend operation.
