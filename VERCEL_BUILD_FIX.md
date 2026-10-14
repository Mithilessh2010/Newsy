# Vercel TypeScript compile fix (v3.0.2)

## Error

`lib/news.ts:7` indexing named HTML entity map with callback argument typed `any` triggers TS7053.

## Resolution

The `namedEntities` table is now explicitly typed as `Record<string, string>` and the replace callback capture is annotated as a `string`. This removes the unsafe index and leaves the feed-decoding behavior unchanged.

## Why it previously passed tests

`ts.transpileModule()` emits JavaScript without performing full semantic TypeScript checks. An actual Next.js build does both.

## Verification

- `npm test`: validated with locally available TypeScript (`NODE_PATH=...`).
- Strict standalone TypeScript: the indexing error is no longer present.
- **Full Next.js/Vercel production build: NOT verified in the current isolated environment** because the npm registry cannot be resolved.

## Apply without replacing your repository

In GitHub edit `lib/news.ts`: annotate the named entity map as `Record<string,string>` and type the regex callback capture `entity:string`. Commit and inspect the next Vercel build.
