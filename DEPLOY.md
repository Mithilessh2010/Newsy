# Launch checklist

The app should deploy on Vercel from the repository root. These steps are written for someone who needs the site to run, not just compile.

### 1. Install and build

Use Node >=20.9, then `npm install`, `npm test`, `npm run typecheck`, and `npm run build`. If the build fails, fix the first error in the output before attempting a second deployment.

### 2. Create the database

Create a Supabase project and run `sql/INSTALL_ALL.sql` in the SQL Editor. This is the initial schema and security setup. Do not run every migration individually after applying the combined installer. Check row-level security on saved items and any user tables.

### 3. Set environment variables

In Vercel Project Settings add the public Supabase URL and anon key, then the private service-role key and a long random `CRON_SECRET`. Optional U.S. government keys are `CONGRESS_API_KEY`, `GOVINFO_API_KEY`, `REGULATIONS_API_KEY`. The file `.env.example` lists everything; do not commit `.env.local`.

### 4. Deploy

Import the project into Vercel as Next.js. No separate build-output directory is needed. After saving variables, redeploy and open the actual deployment URL.

### 5. Smoke-test a public session

- Homepage loads and Earth image is visible even if WebGL is blocked.
- Search navigates to a results page.
- `/api/news?scope=world` returns JSON. Some live feeds can rate-limit or temporarily fail; this should not crash the page.
- `/api/discover?mode=records&country=GB&q=housing` returns the source-status list and records when providers respond.
- `/api/discover?mode=records&country=US&q=schools` works even before optional keys are configured, through the Federal Register and archive links.
- `/api/world-events` returns JSON and natural-event items when sources are available.
- Sign-up/sign-in and saved stories work after Supabase Auth is enabled and redirect URLs are correctly configured.
- Confirm every record links to its **original source**.

### 6. Activate archival jobs

`vercel.json` configures daily collection routes. Vercel cron authorization requires `CRON_SECRET`; the routes must reject requests without it. If you want more frequent collection, review `sql/production-scheduler.sql`, configure Vault secrets, and enable the database scheduler separately. Provider quotas and Vercel plan limits apply. Don't run two overlapping schedules without checking duplicate writes and cost.

### 7. Publish the live URL and evidence

Once the deployment works, add its real URL to the top of `README.md`. Capture one actual production screenshot and replace the design-preview image in the README. Add the demo video if available. Until then, the screenshots in `docs/` are explicitly marked static previews, not proof of deployment.

### If something fails

- **Build:** Check `npm run build` locally and Vercel Build Logs; verify the Node runtime.
- **No accounts / archive:** Verify Supabase URL, keys, tables, RLS policies and Auth redirect settings.
- **Blank globe:** Test with WebGL disabled; `public/media/earth-blue-marble.webp` should still display.
- **Empty records:** Inspect the `sources` statuses returned by `/api/discover`. `not_configured` is different from `unavailable`.
- **Provider 429/403:** Do not retry in a tight loop. Check limits, licensing and origin policies.

Never paste private keys or database credentials into issue reports or screenshots.
