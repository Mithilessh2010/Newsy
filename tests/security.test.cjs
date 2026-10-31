const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..');
const src = p => fs.readFileSync(path.join(root, p), 'utf8');
test('Service-role credential stays outside client-rendered modules', () => {
    const files = fs.readdirSync(path.join(root, 'components')).filter(x => x.endsWith('.tsx'));
    for (const file of files)
        assert.doesNotMatch(src('components/' + file), /SUPABASE_SERVICE_ROLE_KEY|CRON_SECRET|process\.env\.SUPABASE_SERVICE_ROLE_KEY/, file);
});
test('News endpoint avoids misleading archive-enabled status on database failure', () => {
    const code = src('app/api/news/route.ts');
    assert.match(code, /archiveAvailable\s*=\s*false/);
    assert.match(code, /archiveAvailable\s*=\s*true/);
    assert.match(code, /archiveEnabled\s*:\s*archiveAvailable/);
});
test('Atomic polling and restrictive policies are present in migration', () => {
    const sql = src('sql/reliability.sql');
    assert.match(sql, /SKIP LOCKED/g);
    assert.match(sql, /lease_until/);
    assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.claim_local_ingestion\(integer\) TO service_role/);
    assert.match(sql, /REVOKE ALL ON FUNCTION public\.claim_wide_ingestion\(integer\) FROM PUBLIC,anon,authenticated/);
});
test('Deployment smoke checks include protected cron and health endpoint', () => {
    const code = src('scripts/smoke.mjs');
    assert.match(code, /\/api\/health/);
    assert.match(code, /\/api\/cron\/ingest/);
    assert.match(code, /REQUIRE_INGESTION/);
});
test('Patches include security-reviewed Next.js baseline and no baked secrets', () => {
    const pack = JSON.parse(src('package.json'));
    assert.equal(pack.dependencies.next, '15.5.28');
    assert.equal(pack.dependencies.react, '19.3.1');
    assert.match(src('.env.example'), /SUPABASE_SERVICE_ROLE_KEY=/);
    assert.doesNotMatch(src('.env.example'), /SUPABASE_SERVICE_ROLE_KEY=\S+/);
});
