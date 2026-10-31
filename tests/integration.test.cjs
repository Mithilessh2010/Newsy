const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
require.extensions['.ts'] = function (mod, file) { const contents = fs.readFileSync(file, 'utf8'); const { outputText } = ts.transpileModule(contents, { fileName: file, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }); mod._compile(outputText, file); };
const originalLoader = Module._load;
const supabaseMock = { createClient: () => { throw Error('Mock database not set'); } };
Module._load = function (name, parent, isMain) {
    if (name.startsWith('@/'))
        return originalLoader.call(this, path.join(root, name.slice(2)) + '.ts', parent, isMain);
    if (name === 'next/server')
        return { NextResponse: { json: (body, options = {}) => ({ body, status: options.status || 200, headers: options.headers || {} }) } };
    if (name === '@supabase/supabase-js')
        return supabaseMock;
    return originalLoader.call(this, name, parent, isMain);
};
const { DEFAULT_LOCATION, FEATURED_LOCATIONS } = require('../lib/location.ts');
const { getNews, parseRss, buildNewsSources } = require('../lib/news.ts');
const { feedLocationKey, storyId, archiveRows, mergeStories } = require('../lib/ingestion.ts');
const { GET: ingest } = require('../app/api/cron/ingest/route.ts');
const { GET: newsEndpoint } = require('../app/api/news/route.ts');
const { GET: healthEndpoint } = require('../app/api/health/route.ts');
const tokyo = FEATURED_LOCATIONS.find(l => l.name === 'Tokyo');
const feed = `<?xml version="1.0"?><rss><channel><item><title>Transit network expands &amp; serves communities - Example Daily</title><source url="https://example.org">Example Daily</source><link>https://example.org/world/transit</link><pubDate>Wed, 14 Oct 2026 13:00:00 GMT</pubDate></item></channel></rss>`;
const req = (href = 'https://example.org/api/cron/ingest', auth = '') => ({ nextUrl: new URL(href), headers: new Headers(auth ? { authorization: auth } : {}) });
const originalFetch = global.fetch;
const originalEnv = { CRON_SECRET: process.env.CRON_SECRET, NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY };
const reset = () => { global.fetch = originalFetch; for (const [key, value] of Object.entries(originalEnv))
    if (value === undefined)
        delete process.env[key];
    else
        process.env[key] = value; supabaseMock.createClient = () => { throw Error('DB not configured'); }; };
test.afterEach(reset);
test('Stable headline IDs match archived records across local/national/world scopes', () => {
    const url = 'https://example.org/world/transit';
    const parsedLocal = parseRss(feed, tokyo, 'local')[0];
    assert.equal(parsedLocal.id, storyId(url, tokyo, 'local'));
    assert.notEqual(storyId(url, tokyo, 'local'), storyId(url, tokyo, 'national'));
    assert.equal(storyId(url, tokyo, 'world'), storyId(url, DEFAULT_LOCATION, 'world'));
    assert.equal(feedLocationKey(tokyo, 'national'), 'JP');
    assert.equal(feedLocationKey(tokyo, 'world'), 'world');
    for (const scope of ['local', 'national', 'world']) {
        const item = parseRss(feed, tokyo, scope)[0];
        const archived = archiveRows([item], tokyo, scope, '2026-10-14T14:00:00Z');
        assert.equal(archived[0].id, item.id);
        assert.equal(archived[0].location_key, feedLocationKey(tokyo, scope));
    }
});
test('Merge removes duplicates by source URL, not just different internal IDs', () => {
    const live = [{ id: 'live', url: 'https://example.org/a', publishedAt: '2026-10-14T00:00:00Z' }];
    const archived = [{ id: 'database-different-id', url: 'https://example.org/a', publishedAt: '2026-10-13T00:00:00Z' },
        { id: 'other', url: 'https://example.org/b', publishedAt: '2026-10-14T01:00:00Z' }];
    const merged = mergeStories(live, archived);
    assert.equal(merged.length, 2);
    assert.equal(merged[0].id, 'other');
    assert.equal(merged[1].id, 'live');
});
test('Publisher RSS parsing safely rejects links and malformed dates', () => {
    const items = parseRss(`<rss><channel><item><title>Invalid</title><link>data:text/html,hi</link><pubDate>Wed, 14 Oct 2026 13:00:00 GMT</pubDate></item><item><title>No date</title><link>https://example.org/b</link></item></channel></rss>`, tokyo);
    assert.equal(items.length, 0);
    assert.throws(() => parseRss('x'.repeat(2000001), tokyo), /too large/);
});
test('News fetching survives one feed failing and reports complete outage honestly', async () => {
    let requests = [];
    global.fetch = async (url) => { requests.push(url); if (String(url).includes('news.google.com'))
        return { ok: false, status: 503 }; return { ok: true, text: async () => feed }; };
    const live = await getNews(DEFAULT_LOCATION, 'local');
    assert.equal(live.available, true);
    assert.equal(live.stories.length, 1);
    assert.equal(live.stories[0].source, 'City of Pleasanton');
    global.fetch = async () => { throw new Error('network down'); };
    const outage = await getNews(tokyo, 'local');
    assert.equal(outage.available, false);
    assert.equal(outage.stories.length, 0);
    assert.equal(requests.length, 2);
});
test('World/national/local queries do not silently reuse local feed identifiers', () => {
    const scopes = ['local', 'national', 'world'];
    for (const scope of scopes) {
        const link = buildNewsSources(tokyo, scope)[0].url;
        assert.equal(new URL(link).searchParams.get('gl'), scope === 'world' ? 'US' : 'JP');
    }
});
test('Ingestion endpoint blocks missing/wrong secrets and missing database', async () => {
    delete process.env.CRON_SECRET;
    let response = await ingest(req());
    assert.equal(response.status, 401);
    process.env.CRON_SECRET = 'test-secret';
    response = await ingest(req());
    assert.equal(response.status, 401);
    response = await ingest(req(undefined, 'Bearer test-secret'));
    assert.equal(response.status, 503);
});
test('Ingestion claims separate local and worldwide queues, archives data, releases leases', async () => {
    process.env.CRON_SECRET = 'test-secret';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'server-only-secret';
    const upserts = [], updates = [], calls = [];
    supabaseMock.createClient = () => ({
        from(table) {
            return {
                upsert: async (rows) => { upserts.push({ table, rows }); return { error: null }; },
                update(payload) { return { eq: async (column, value) => { updates.push({ table, payload, column, value }); return { error: null }; } }; }
            };
        },
        rpc: async (name) => { calls.push(name); return { error: null, data: name === 'claim_local_ingestion' ? [{ location_key: tokyo.id, city: 'Tokyo', region: 'Tokyo', country_code: 'JP' }] : [{ feed_key: 'world', scope: 'world', city: 'Worldwide', region: '', country_code: 'US' }, { feed_key: 'national:JP', scope: 'national', city: 'Tokyo', region: 'Tokyo', country_code: 'JP' }] }; }
    });
    global.fetch = async () => ({ ok: true, text: async () => feed });
    const response = await ingest(req(undefined, 'Bearer test-secret'));
    assert.equal(response.status, 200);
    assert.equal(response.body.claimed, 3);
    assert.equal(response.body.failed, 0);
    assert.equal(upserts.filter(x => x.table === 'news_items').length, 3);
    assert.deepEqual(upserts.filter(x => x.table === 'news_items').map(x => x.rows[0].scope).sort(), ['local', 'national', 'world']);
    assert.ok(updates.every(x => x.payload.lease_until === null));
    assert.deepEqual(calls.sort(), ['claim_local_ingestion', 'claim_wide_ingestion']);
});
test('Ingestion reports a failed provider poll and releases its lease', async () => {
    process.env.CRON_SECRET = 'test-secret';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'server-only-secret';
    let released = false;
    supabaseMock.createClient = () => ({
        from(table) { return { upsert: async () => ({ error: null }), update: () => ({ eq: async () => { released = true; return { error: null }; } }) }; },
        rpc: async (name) => ({ error: null, data: name === 'claim_local_ingestion' ? [{ location_key: tokyo.id, city: 'Tokyo', region: 'Tokyo', country_code: 'JP' }] : [] })
    });
    global.fetch = async () => { throw new Error('503 outage'); };
    const response = await ingest(req(undefined, 'Bearer test-secret'));
    assert.equal(response.status, 207);
    assert.equal(response.body.failed, 1);
    assert.equal(response.body.polled[0].ok, false);
    assert.equal(released, true);
});
test('News endpoint merges fresh headlines with the archived version by URL', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'server-only-secret';
    global.fetch = async () => ({ ok: true, text: async () => feed });
    supabaseMock.createClient = () => ({ from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ order: () => ({ limit: async () => ({ error: null, data: [{ id: 'a-legacy', title: 'Transit network expands', publisher: 'Example Daily', url: 'https://example.org/world/transit', published_at: '2026-10-13T00:00:00Z', category: 'Transportation', city: 'Tokyo', country_code: 'JP', scope: 'local' }] }) }) }) }) }) }) });
    const response = await newsEndpoint(req('https://example.org/api/news?city=Tokyo&region=Tokyo&country=JP&scope=local'));
    assert.equal(response.status, 200);
    assert.equal(response.body.stories.length, 1);
    assert.equal(response.body.stories[0].id, storyId('https://example.org/world/transit', tokyo, 'local'));
});
test('Operational health endpoint distinguishes a configured app from live ingestion', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    let result = await healthEndpoint();
    assert.equal(result.status, 503);
    assert.equal(result.body.status, 'not_configured');
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'secret';
    supabaseMock.createClient = () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ error: null, data: { last_checked_at: new Date().toISOString(), last_status: 'ok' } }) }) }) }) });
    result = await healthEndpoint();
    assert.equal(result.status, 200);
    assert.equal(result.body.ingestion, true);
});
