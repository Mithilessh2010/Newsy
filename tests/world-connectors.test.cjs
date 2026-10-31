const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fetchGlobalSource, isSource, ProviderError } = require('../.compiled/world-connectors.js');
const mock = (obj) => async (url, init) => ({ ok: true, status: 200, json: async () => obj, url, headers: init?.headers });
const run = (source, body, query = {}, keys = {}) => fetchGlobalSource({ source, ...query }, { fetcher: mock(body), credentials: keys });
test('unknown provider is rejected', async () => assert.rejects(() => run('untrusted', {}), e => e.code === 'INVALID_INPUT'));
test('GDELT normalizes metadata and does not embed content', async () => {
    const r = await run('gdelt', { articles: [{ title: 'Public briefing', domain: 'example.org', language: 'English', url: 'https://example.org/story', seendate: '20261027T000000Z' }] }, { q: 'briefing' });
    assert.equal(r.items[0].category, 'news');
    assert.equal(r.items[0].url, 'https://example.org/story');
    assert.equal(r.items.length, 1);
});
test('USGS maps a geographic event', async () => { const r = await run('usgs', { features: [{ id: 'eq-1', properties: { title: 'M5.4 earthquake', mag: 5.4, place: 'region', url: 'https://earthquake.usgs.gov/earthquakes/eventpage/eq-1', time: 1790000000000 }, geometry: { coordinates: [140, 35, 2] } }] }); assert.deepEqual(r.items[0].location, { latitude: 35, longitude: 140 }); });
test('NASA EONET uses most recent event geometry', async () => { const r = await run('nasa-eonet', { events: [{ id: 'EONET_4', title: 'Wildfire', link: 'https://eonet.gsfc.nasa.gov/api/v3/events/EONET_4', geometry: [{ date: '2026-10-12', coordinates: [-120, 37] }] }] }); assert.equal(r.items[0].title, 'Wildfire'); });
test('GDACS returns a disaster entry', async () => { const r = await run('gdacs', { features: [{ id: 123, properties: { eventid: 123, eventtype: 'EQ', name: 'Earthquake', alertlevel: 'red', fromdate: '2026-10-26' }, geometry: { coordinates: [20, 40] } }] }); assert.equal(r.items.length, 1); assert.equal(r.items[0].location.latitude, 40); });
test('Federal Register records', async () => { const r = await run('federal-register', { results: [{ document_number: 'A-24', title: 'Official notice', html_url: 'https://www.federalregister.gov/documents/A-24', publication_date: '2026-10-24' }] }); assert.equal(r.items[0].category, 'record'); });
test('Library of Congress records', async () => { const r = await run('loc', { results: [{ id: 'https://www.loc.gov/item/abc/', title: 'Historic city atlas', date: '1889', description: ['archival map'] }] }); assert.equal(r.items[0].category, 'archive'); });
test('Worldwide city search', async () => { const r = await run('open-meteo-places', { results: [{ id: 2, name: 'Tokyo', country: 'Japan', admin1: 'Tokyo', latitude: 35.67, longitude: 139.67 }] }, { q: 'Tokyo' }); assert.equal(r.items[0].location.longitude, 139.67); });
test('Place search short queries rejected', async () => assert.rejects(() => run('open-meteo-places', {}, { q: 'x' }), e => e.code === 'INVALID_INPUT'));
test('Crossref scholarly metadata', async () => { const r = await run('crossref', { message: { items: [{ DOI: '10.1111/abc', title: ['Research update'], publisher: 'Journal', URL: 'https://doi.org/10.1111/abc' }] } }, { q: 'research' }); assert.equal(r.items[0].category, 'research'); });
test('World Bank indicators parse array payload', async () => { const r = await run('worldbank', [{}, [{ country: { value: 'India', id: 'IN' }, countryiso3code: 'IND', date: '2025', value: 100 }]]); assert.equal(r.items[0].category, 'statistic'); });
test('GOV UK known-path content', async () => { const r = await run('govuk', { content_id: 'abc', title: 'Take your pet abroad', description: 'Official guidance', base_path: '/take-pet-abroad', public_updated_at: '2026-10-01' }); assert.equal(r.items[0].url, 'https://www.gov.uk/take-pet-abroad'); });
test('GOV UK prevents arbitrary upstream URL targets', async () => assert.rejects(() => run('govuk', {}, { path: '//evil.com/' }), e => e.code === 'INVALID_INPUT'));
test('Congress is disabled without a key', async () => assert.rejects(() => run('congress', {}), e => e.code === 'NOT_CONFIGURED'));
test('GovInfo is disabled without a key', async () => assert.rejects(() => run('govinfo', {}), e => e.code === 'NOT_CONFIGURED'));
test('Regulations.gov is disabled without a key', async () => assert.rejects(() => run('regulations', {}), e => e.code === 'NOT_CONFIGURED'));
test('Congress metadata no credentials in results', async () => { const r = await run('congress', { bills: [{ type: 'HR', congress: 119, number: 12, title: 'Sample Bill', latestAction: { text: 'Introduced', actionDate: '2026-01-01' } }] }, {}, { congress: 'sensitive-test-key' }); assert.equal(r.items[0].url, 'https://www.congress.gov/bill/119th-congress/house-bill/12'); assert.ok(!JSON.stringify(r).includes('sensitive-test-key')); });
test('GovInfo archive records', async () => { const r = await run('govinfo', { packages: [{ packageId: 'CREC-2026-10-26', title: 'Congressional Record', lastModified: '2026-10-26' }] }, {}, { govinfo: 'fake' }); assert.ok(r.items[0].url.includes('CREC-2026-10-26')); });
test('Regulations.gov returns docket document', async () => { const r = await run('regulations', { data: [{ id: 'EPA-2026-01', attributes: { title: 'Notice', documentType: 'Proposed Rule', postedDate: '2026-10-26' } }] }, {}, { regulations: 'fake' }); assert.equal(r.items[0].url, 'https://www.regulations.gov/document/EPA-2026-01'); });
test('Skips malicious data URLs', async () => { const r = await run('gdelt', { articles: [{ title: 'Bad item', url: 'javascript:alert(1)' }] }); assert.equal(r.items.length, 0); });
test('Respects result limit and normalizes invalid limit', async () => { const body = { articles: Array.from({ length: 35 }, (_, i) => ({ title: 'Article ' + i, url: 'https://example.org/' + i })) }; const r = await run('gdelt', body, { limit: 100 }); assert.equal(r.items.length, 20); });
test('Upstream failure surfaces typed error without raw credentials', async () => { await assert.rejects(() => fetchGlobalSource({ source: 'congress' }, { credentials: { congress: 'dont-leak' }, fetcher: async () => ({ ok: false, status: 429 }) }), e => e.code === 'UPSTREAM_UNAVAILABLE' && !e.message.includes('dont-leak')); });
test('Registry contains 15 implemented unique integrations', () => { const entries = require('../sources.json'); assert.equal(entries.filter(e => e.implementation === 'adapter').length, 15); assert.equal(new Set(entries.map(e => e.id)).size, entries.length); });
test('GOV.UK search gives original official document links', async () => {
    const r = await run('govuk-search', { results: [{ title: 'Official flood guidance', link: '/government/publications/flood-guidance', description: 'Guidance from GOV.UK', public_timestamp: '2026-10-10T00:00:00Z' }] }, { q: 'flood' });
    assert.equal(r.items[0].url, 'https://www.gov.uk/government/publications/flood-guidance');
    assert.equal(r.items[0].category, 'record');
});
test('UK Parliament returns bill records', async () => {
    const r = await run('uk-parliament', { items: [{ billId: 1478, shortTitle: 'Housing Bill', currentHouse: 'Commons', lastUpdate: '2026-10-10T00:00:00Z' }] }, { q: 'housing' });
    assert.equal(r.items[0].url, 'https://bills.parliament.uk/bills/1478');
});
test('Malformed provider success response is rejected, not treated as empty verified data', async () => {
    await assert.rejects(() => run('gdelt', { error: 'Upstream schema changed' }), error => error.code === 'UPSTREAM_UNAVAILABLE');
    await assert.rejects(() => run('govuk', null), error => error.code === 'UPSTREAM_UNAVAILABLE');
});
test('An empty but structurally valid response is allowed', async () => {
    const result = await run('gdelt', { articles: [] });
    assert.deepEqual(result.items, []);
});
test('Invalid calendar dates and out-of-range coordinates are discarded', async () => {
    const result = await run('usgs', { features: [
            {
                id: 'impossible',
                properties: { title: 'Invalid timestamp', url: 'https://example.org/earthquake', time: 1e200 },
                geometry: { coordinates: [Infinity, 34] },
            },
            {
                id: 'valid',
                properties: { title: 'Valid earthquake', url: 'https://example.org/valid', time: 1790000000000 },
                geometry: { coordinates: [20, 100] },
            },
        ] });
    assert.equal(result.items.length, 2);
    assert.equal(result.items[0].publishedAt, null);
    assert.equal(result.items[0].location, undefined);
    assert.equal(result.items[1].location, undefined);
    const records = await run('federal-register', {
        results: [{ document_number: 'invalid-date', title: 'Notice', html_url: 'https://example.org/notice', publication_date: '2026-02-30' }],
    });
    assert.equal(records.items[0].publishedAt, null);
});
test('Geocode rejects non-finite and impossible coordinates rather than linking to invalid maps', async () => {
    const result = await run('open-meteo-places', { results: [
            { id: 1, name: 'Good', latitude: 37.6, longitude: -122.2 },
            { id: 2, name: 'Bad', latitude: 500, longitude: 400 },
            { id: 3, name: 'Missing', latitude: 'unknown', longitude: null },
        ] }, { q: 'place' });
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].title, 'Good');
});
test('Fetch timeout/failure becomes a typed upstream failure without exposing internal details', async () => {
    const error = new DOMException('Timed out', 'TimeoutError');
    await assert.rejects(() => fetchGlobalSource({ source: 'gdelt' }, {
        fetcher: async (_url, options) => {
            assert.ok(options.signal instanceof AbortSignal);
            throw error;
        },
    }), e => e.code === 'UPSTREAM_UNAVAILABLE' && !e.message.includes('Timed out'));
});
