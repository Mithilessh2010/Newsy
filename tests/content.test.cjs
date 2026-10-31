const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
test('Next.js app routes and API exist', () => { for (const p of ['app/layout.tsx', 'app/page.tsx', 'app/news/page.tsx', 'app/explore/page.tsx', 'app/records/page.tsx', 'app/timelines/[slug]/page.tsx', 'app/account/page.tsx', 'app/saved/page.tsx', 'app/search/page.tsx', 'app/api/news/route.ts', 'app/api/cron/ingest/route.ts', 'sql/schema.sql'])
    assert.ok(fs.existsSync(path.join(root, p)), p); });
test('Public information source links have safe HTTPS schemes', () => {
    const ts = require('typescript');
    const vm = require('node:vm');
    const code = ts.transpileModule(fs.readFileSync(path.join(root, 'lib/content.ts'), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const sandbox = { exports: {} };
    vm.runInNewContext(code, sandbox);
    const urls = sandbox.exports.records.map(row => row.url);
    assert.ok(urls.length >= 10);
    assert.ok(urls.every(url => new URL(url).protocol === 'https:'));
});
test('Ingestion endpoint is secret protected', () => { const src = fs.readFileSync(path.join(root, 'app/api/cron/ingest/route.ts'), 'utf8'); assert.match(src, /CRON_SECRET/); assert.match(src, /Unauthorized/); assert.match(src, /SUPABASE_SERVICE_ROLE_KEY/); });
test('Avoid unverified mock-news headlines in starter feed', () => { const src = fs.readFileSync(path.join(root, 'lib/content.ts'), 'utf8'); assert.ok(!src.includes('approved controversial housing plan')); assert.match(src, /source/ig); });
