const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { discover } = require('../.compiled/world-service.js');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const fake = async (url) => {
    if (url.includes('earthquake.usgs.gov'))
        return { ok: true, json: async () => ({ features: [{ id: 'eq1', properties: { title: 'Official earthquake', url: 'https://earthquake.usgs.gov/eq1', time: 1790000000000 }, geometry: { coordinates: [-118, 34] } }] }) };
    if (url.includes('eonet.gsfc'))
        return { ok: true, json: async () => ({ events: [{ id: 'n1', title: 'Official wildfire', link: 'https://eonet.gsfc.nasa.gov/event/n1', geometry: [{ date: '2026-10-27T00:00:00Z', coordinates: [-115, 33] }] }] }) };
    if (url.includes('federalregister.gov'))
        return { ok: true, json: async () => ({ results: [{ document_number: 'FR-1', title: 'Public notice', html_url: 'https://www.federalregister.gov/documents/test', publication_date: '2026-10-27' }] }) };
    if (url.includes('bills-api.parliament.uk'))
        return { ok: true, json: async () => ({ items: [{ billId: 2000, shortTitle: 'Public Services Bill', lastUpdate: '2026-10-20' }] }) };
    if (url.includes('gov.uk/api/search.json'))
        return { ok: true, json: async () => ({ results: [{ title: 'Public services notice', link: '/government/publications/public-services' }] }) };
    if (url.includes('loc.gov'))
        return { ok: true, json: async () => ({ results: [{ id: 'https://www.loc.gov/item/a/', title: 'Historic city map' }] }) };
    if (url.includes('api.crossref.org'))
        return { ok: true, json: async () => ({ message: { items: [{ DOI: '10.1234/test', title: ['Research'], URL: 'https://doi.org/10.1234/test' }] } }) };
    throw new Error('Unsupported mocked source ' + url);
};
test('global event discovery normalizes geolocated updates', async () => { const r = await discover({ mode: 'events', sources: ['usgs', 'nasa-eonet'], limit: 5 }, { fetcher: fake }); assert.equal(r.items.length, 2); assert.equal(r.items[0].category, 'event'); assert.equal(r.sources.filter(s => s.status === 'ok').length, 2); });
test('country without a tailored government API falls back to international archives', async () => { const r = await discover({ mode: 'records', country: 'IN', q: 'history', limit: 4 }, { fetcher: fake }); assert.deepEqual(r.sources.map(s => s.id), ['loc', 'crossref']); assert.equal(r.items.length, 2); });
test('US federal records use verified public source without a key', async () => { const r = await discover({ mode: 'records', country: 'US', limit: 5 }, { fetcher: fake }); assert.equal(r.sources.find(s => s.id === 'federal-register').status, 'ok'); assert.equal(r.items.filter(i => i.category === 'record').length, 1); assert.ok(r.sources.some(s => s.status === 'not_configured')); });
test('global ingestion API requires secret and never returns credentials', () => { const s = read('app/api/cron/ingest-global/route.ts'); assert.match(s, /Bearer \$\{secret\}/); assert.match(s, /status\s*:\s*401/); assert.doesNotMatch(s, /CONGRESS_API_KEY|GOVINFO_API_KEY|REGULATIONS_API_KEY/); });
test('records interface and home source list are actually wired to server routes', () => { assert.match(read('components/FinalHome.tsx'), /WorldEvents/); assert.match(read('components/FinalHome.tsx'), /GlobalSourcesExplorer/); assert.match(read('components/GlobalSourcesExplorer.tsx'), /\/api\/discover/); assert.match(read('components/WorldEvents.tsx'), /\/api\/world-events/); });
test('sensitive credentials are never passed as public client props', () => { for (const f of ['components/FinalHome.tsx', 'components/GlobalSourcesExplorer.tsx', 'components/WorldEvents.tsx'])
    assert.doesNotMatch(read(f), /SERVICE_ROLE_KEY|CONGRESS_API_KEY|GOVINFO_API_KEY|REGULATIONS_API_KEY/); });
test('real imagery fallback and globe are deployed locally', () => { assert.ok(fs.statSync(path.join(root, 'public/media/earth-blue-marble.webp')).size > 30000); assert.match(read('lib/globe-engine.js'), /\/media\/earth-blue-marble.webp/); });
test('SQL protects global items from unauthorized writes', () => { const sql = read('sql/global-integration.sql'); assert.match(sql, /ENABLE ROW LEVEL SECURITY/); assert.match(sql, /REVOKE INSERT, UPDATE, DELETE/); });
test('UK official document search uses both government and parliament without credentials', async () => {
    const r = await discover({ mode: 'records', country: 'GB', q: 'services', limit: 5 }, { fetcher: fake });
    assert.ok(r.sources.some(s => s.id === 'govuk-search' && s.status === 'ok'));
    assert.ok(r.sources.some(s => s.id === 'uk-parliament' && s.status === 'ok'));
    assert.ok(r.items.some(i => i.url.startsWith('https://www.gov.uk/')));
});
test('discovery respects the public result limit, not a multiple of it', async () => {
    const r = await discover({ mode: 'events', sources: ['usgs', 'nasa-eonet'], limit: 1 }, { fetcher: fake });
    assert.equal(r.items.length, 1);
    assert.equal(r.sources.length, 2);
});
test('a provider listed twice is only queried once', async () => {
    const r = await discover({ mode: 'events', sources: ['usgs', 'usgs'], limit: 10 }, { fetcher: fake });
    assert.deepEqual(r.sources.map(source => source.id), ['usgs']);
    assert.equal(r.items.length, 1);
});
test('a source restricted to another country is not queried', async () => {
    const r = await discover({ mode: 'records', country: 'IN', sources: ['congress', 'govuk-search', 'loc'], limit: 10 }, { fetcher: fake });
    assert.deepEqual(r.sources.map(source => source.id), ['loc']);
});
test('invalid country code is rejected at the discovery service boundary', async () => {
    await assert.rejects(() => discover({ mode: 'records', country: 'NOT_A_COUNTRY' }, { fetcher: fake }), error => error instanceof RangeError && error.message.includes('country'));
});
test('same URL with different fragments or final slashes deduplicates across providers', async () => {
    const same = async (url) => {
        if (url.includes('api.crossref.org'))
            return {
                ok: true,
                json: async () => ({ message: { items: [
                            { DOI: '10.1234/same', title: ['Shared item'], URL: 'https://example.org/story/#overview' },
                        ] } }),
            };
        if (url.includes('loc.gov'))
            return {
                ok: true,
                json: async () => ({ results: [
                        { id: 'https://example.org/story', title: 'Same archived document' },
                    ] }),
            };
        throw new Error('unsupported URL');
    };
    const result = await discover({ mode: 'archives', sources: ['loc', 'crossref'], limit: 10 }, { fetcher: same });
    assert.equal(result.items.length, 1);
    assert.equal(result.sources.length, 2);
});
