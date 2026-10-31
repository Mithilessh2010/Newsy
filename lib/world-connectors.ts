export type GlobalSourceId = 'gdelt' | 'usgs' | 'nasa-eonet' | 'gdacs' | 'federal-register' | 'loc' | 'open-meteo-places' | 'crossref' | 'worldbank' | 'govuk' | 'congress' | 'govinfo' | 'regulations' | 'govuk-search' | 'uk-parliament';
export type GlobalItem = {
    id: string;
    source: string;
    category: 'news' | 'event' | 'record' | 'archive' | 'statistic' | 'research' | 'place';
    title: string;
    description: string;
    url: string;
    publishedAt: string | null;
    country?: string;
    location?: {
        latitude: number;
        longitude: number;
    };
};
export type GlobalQuery = {
    source: GlobalSourceId;
    q?: string;
    country?: string;
    limit?: number;
    path?: string;
};
export type Credentials = {
    congress?: string;
    govinfo?: string;
    regulations?: string;
};
export type GlobalResult = {
    provider: GlobalSourceId;
    items: GlobalItem[];
    retrievedAt: string;
};
const SOURCES: ReadonlySet<string> = new Set([
    'gdelt', 'usgs', 'nasa-eonet', 'gdacs', 'federal-register', 'loc',
    'open-meteo-places', 'crossref', 'worldbank', 'govuk',
    'congress', 'govinfo', 'regulations', 'govuk-search', 'uk-parliament'
]);
export function isSource(x: string): x is GlobalSourceId { return SOURCES.has(x); }
export class ProviderError extends Error {
    constructor(public code: 'INVALID_INPUT' | 'NOT_CONFIGURED' | 'UPSTREAM_UNAVAILABLE', message: string) { super(message); }
}
const rec = (x: unknown): Record<string, any> => (x && typeof x === 'object' && !Array.isArray(x)) ? x as Record<string, any> : {};
const arr = (x: unknown): any[] => Array.isArray(x) ? x : [];
const txt = (x: unknown): string => typeof x === 'string' ? x.trim() : (typeof x === 'number' ? String(x) : '');
const str = (x: unknown, n = 700): string => txt(x).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').slice(0, n);
const safeUrl = (x: unknown): string => { try {
    const u = new URL(txt(x));
    return ['http:', 'https:'].includes(u.protocol) ? u.toString() : '';
}
catch {
    return '';
} };
const take = (xs: unknown, n: number): any[] => arr(xs).slice(0, n);
const coord = (a: unknown): {
    latitude: number;
    longitude: number;
} | undefined => {
    if (!Array.isArray(a) || typeof a[0] !== 'number' || typeof a[1] !== 'number')
        return;
    const [longitude, latitude] = a;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180)
        return;
    return { latitude, longitude };
};
export function normalizePublishedDate(value: unknown): string | null {
    if (typeof value !== 'string' && typeof value !== 'number')
        return null;
    const input = String(value).trim();
    if (!input || !/^\d{4}(?:$|[-T\s/,])/.test(input))
        return null;
    const calendar = /^(\d{4})-(\d{2})-(\d{2})/.exec(input);
    if (calendar) {
        const year = Number(calendar[1]);
        const month = Number(calendar[2]);
        const day = Number(calendar[3]);
        const midnight = new Date(Date.UTC(year, month - 1, day));
        if (midnight.getUTCFullYear() !== year || midnight.getUTCMonth() !== month - 1 || midnight.getUTCDate() !== day)
            return null;
    }
    const parsed = Date.parse(input);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}
function validateProviderPayload(source: GlobalSourceId, value: unknown): void {
    const obj = rec(value);
    const collection = ({
        gdelt: obj.articles, usgs: obj.features, 'nasa-eonet': obj.events,
        'federal-register': obj.results, loc: obj.results,
        'open-meteo-places': obj.results, crossref: rec(obj.message).items,
        'govuk-search': obj.results, 'uk-parliament': obj.items,
        congress: obj.bills, govinfo: obj.packages, regulations: obj.data,
    } as Partial<Record<GlobalSourceId, unknown>>)[source];
    if (source === 'worldbank') {
        if (!Array.isArray(value) || !Array.isArray(value[1]))
            throw new ProviderError('UPSTREAM_UNAVAILABLE', 'World Bank response was not recognized');
    }
    else if (source === 'gdacs') {
        if (!Array.isArray(obj.features) && !Array.isArray(value))
            throw new ProviderError('UPSTREAM_UNAVAILABLE', 'GDACS response was not recognized');
    }
    else if (source === 'govuk') {
        if (typeof obj.title !== 'string' || typeof obj.base_path !== 'string')
            throw new ProviderError('UPSTREAM_UNAVAILABLE', 'GOV.UK response was not recognized');
    }
    else if (!Array.isArray(collection)) {
        throw new ProviderError('UPSTREAM_UNAVAILABLE', 'Provider response was not recognized');
    }
}
const article = (id: string, source: string, category: GlobalItem['category'], title: unknown, description: unknown, url: unknown, publishedAt: unknown, location?: GlobalItem['location']): GlobalItem | null => {
    const safe = safeUrl(url), name = str(title, 320);
    if (!safe || !name)
        return null;
    return { id, source, category, title: name, description: str(description), url: safe, publishedAt: normalizePublishedDate(publishedAt), ...(location ? { location } : {}) };
};
export async function fetchGlobalSource(query: GlobalQuery, config: {
    fetcher?: typeof fetch;
    credentials?: Credentials;
} = {}): Promise<GlobalResult> {
    if (!isSource(query.source))
        throw new ProviderError('INVALID_INPUT', 'Unknown source');
    const q = (query.q || '').trim().slice(0, 100);
    const country = (query.country || '').trim().toUpperCase();
    if (country && !/^[A-Z]{2,3}$/.test(country))
        throw new ProviderError('INVALID_INPUT', 'Use a two- or three-letter country code');
    const requestedLimit = Number.isFinite(query.limit) ? query.limit! : 10;
    const limit = Math.max(1, Math.min(20, Math.floor(requestedLimit)));
    const fetcher = config.fetcher || fetch;
    const keys = config.credentials || {};
    let endpoint = '';
    let init: RequestInit = {};
    let name = '';
    const params = new URLSearchParams();
    const requireKey = (key?: string): string => { if (!key)
        throw new ProviderError('NOT_CONFIGURED', 'Server-side provider key is not configured'); return key; };
    switch (query.source) {
        case 'gdelt':
            name = 'GDELT Project';
            params.set('query', q || '(earthquake OR cyclone OR parliament)');
            params.set('mode', 'artlist');
            params.set('format', 'json');
            params.set('maxrecords', String(limit));
            endpoint = 'https://api.gdeltproject.org/api/v2/doc/doc?' + params;
            break;
        case 'usgs':
            name = 'USGS';
            endpoint = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson';
            break;
        case 'nasa-eonet':
            name = 'NASA EONET';
            endpoint = 'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=' + limit;
            break;
        case 'gdacs': {
            name = 'GDACS';
            const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
            params.set('fromdate', since);
            params.set('eventlist', 'EQ;TC;FL;VO;WF');
            endpoint = 'https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?' + params;
            break;
        }
        case 'federal-register':
            name = 'US Federal Register';
            params.set('per_page', String(limit));
            params.set('order', 'newest');
            if (q)
                params.set('conditions[term]', q);
            endpoint = 'https://www.federalregister.gov/api/v1/documents.json?' + params;
            break;
        case 'loc':
            name = 'Library of Congress';
            params.set('fo', 'json');
            params.set('c', String(limit));
            params.set('q', q || 'history');
            endpoint = 'https://www.loc.gov/search/?' + params;
            break;
        case 'open-meteo-places':
            name = 'Open-Meteo Geocoding';
            if (q.length < 2)
                throw new ProviderError('INVALID_INPUT', 'Place search requires at least two characters');
            params.set('name', q);
            params.set('count', String(limit));
            params.set('language', 'en');
            if (country.length === 2)
                params.set('countryCode', country);
            endpoint = 'https://geocoding-api.open-meteo.com/v1/search?' + params;
            break;
        case 'crossref':
            name = 'Crossref';
            params.set('query', q || 'climate');
            params.set('rows', String(limit));
            endpoint = 'https://api.crossref.org/works?' + params;
            break;
        case 'worldbank':
            name = 'World Bank';
            params.set('format', 'json');
            params.set('per_page', String(limit));
            endpoint = `https://api.worldbank.org/v2/country/${country || 'all'}/indicator/SP.POP.TOTL?${params}`;
            break;
        case 'govuk': {
            name = 'GOV.UK';
            const path = (query.path || '/take-pet-abroad').trim();
            if (!/^\/[a-z0-9/-]{1,150}$/.test(path) || path.includes('//') || path.includes('..'))
                throw new ProviderError('INVALID_INPUT', 'Invalid GOV.UK content path');
            endpoint = 'https://www.gov.uk/api/content' + path;
            break;
        }
        case 'govuk-search':
            name = 'GOV.UK Search';
            params.set('q', q || 'government');
            params.set('count', String(limit));
            endpoint = 'https://www.gov.uk/api/search.json?' + params;
            break;
        case 'uk-parliament':
            name = 'UK Parliament';
            params.set('Take', String(limit));
            if (q)
                params.set('SearchTerm', q);
            endpoint = 'https://bills-api.parliament.uk/api/v1/Bills?' + params;
            break;
        case 'congress':
            name = 'Congress.gov';
            params.set('format', 'json');
            params.set('limit', String(limit));
            init.headers = { 'X-Api-Key': requireKey(keys.congress) };
            endpoint = 'https://api.congress.gov/v3/bill?' + params;
            break;
        case 'govinfo': {
            name = 'GovInfo';
            init.headers = { 'X-Api-Key': requireKey(keys.govinfo) };
            const date = new Date(Date.now() - 30 * 86400000).toISOString().replace(/\.\d{3}Z$/, 'Z');
            params.set('pageSize', String(limit));
            params.set('offsetMark', '*');
            endpoint = `https://api.govinfo.gov/collections/CREC/${date}?${params}`;
            break;
        }
        case 'regulations':
            name = 'Regulations.gov';
            init.headers = { 'X-Api-Key': requireKey(keys.regulations) };
            params.set('sort', '-postedDate');
            params.set('page[size]', String(limit));
            if (q)
                params.set('filter[searchTerm]', q);
            endpoint = 'https://api.regulations.gov/v4/documents?' + params;
            break;
    }
    let body: any;
    try {
        const response = await fetcher(endpoint, { ...init, headers: { 'Accept': 'application/json', 'User-Agent': 'EqualHorizons/1.0 (public-data aggregator)', ...rec(init.headers) }, signal: AbortSignal.timeout(9000) });
        if (!response.ok)
            throw new Error('HTTP ' + response.status);
        body = await response.json();
    }
    catch {
        throw new ProviderError('UPSTREAM_UNAVAILABLE', `${name} is temporarily unavailable`);
    }
    validateProviderPayload(query.source, body);
    const items: (GlobalItem | null)[] = [];
    switch (query.source) {
        case 'gdelt':
            for (const r of take(rec(body).articles, limit))
                items.push(article(`gdelt:${txt(r.url)}`, name, 'news', r.title, `${r.domain || ''} · ${r.language || ''}`, r.url, typeof r.seendate === 'string' && /^\d{8}T\d{6}Z$/.test(r.seendate) ? `${r.seendate.slice(0, 4)}-${r.seendate.slice(4, 6)}-${r.seendate.slice(6, 8)}T${r.seendate.slice(9, 11)}:${r.seendate.slice(11, 13)}:${r.seendate.slice(13, 15)}Z` : r.seendate));
            break;
        case 'usgs':
            for (const f of take(rec(body).features, limit)) {
                const p = rec(f.properties);
                const date = Number.isFinite(p.time) && Math.abs(p.time) <= 8640000000000000 ? new Date(p.time).toISOString() : null;
                items.push(article(`usgs:${txt(f.id)}`, name, 'event', p.title, `Magnitude ${p.mag ?? 'n/a'} · ${p.place || ''}`, p.url, date, coord(rec(f.geometry).coordinates)));
            }
            break;
        case 'nasa-eonet':
            for (const e of take(rec(body).events, limit)) {
                const g = arr(e.geometry).at(-1) || {};
                const first = arr(e.sources)[0] || {};
                items.push(article(`eonet:${txt(e.id)}`, name, 'event', e.title, arr(e.categories)[0]?.title || 'Natural event', e.link || first.url, g.date, coord(g.coordinates)));
            }
            break;
        case 'gdacs': {
            const fs = arr(rec(body).features).length ? rec(body).features : arr(body);
            for (const f of take(fs, limit)) {
                const p = rec(f.properties);
                const d = rec(p.event);
                const key = p.eventid || d.eventid || f.id;
                items.push(article(`gdacs:${key}`, name, 'event', p.name || p.title || `Disaster event ${key}`, `${p.alertlevel || ''} ${p.eventtype || ''}`, `https://www.gdacs.org/report.aspx?eventid=${encodeURIComponent(txt(key))}&eventtype=${encodeURIComponent(txt(p.eventtype || 'EQ'))}`, p.todate || p.fromdate || p.pubDate, coord(rec(f.geometry).coordinates)));
            }
            break;
        }
        case 'federal-register':
            for (const r of take(rec(body).results, limit))
                items.push(article(`fr:${r.document_number}`, name, 'record', r.title, r.abstract, r.html_url || r.pdf_url, r.publication_date));
            break;
        case 'loc':
            for (const r of take(rec(body).results, limit))
                items.push(article(`loc:${txt(r.id)}`, name, 'archive', r.title, arr(r.description).join(' ') || r.description, r.id || r.url, r.date));
            break;
        case 'open-meteo-places':
            for (const r of take(rec(body).results, limit)) {
                const geo = { latitude: Number(r.latitude), longitude: Number(r.longitude) };
                if (Number.isFinite(geo.latitude) && Number.isFinite(geo.longitude) && Math.abs(geo.latitude) <= 90 && Math.abs(geo.longitude) <= 180) {
                    items.push(article(`place:${r.id}`, name, 'place', [r.name, r.admin1, r.country].filter(Boolean).join(', '), r.timezone || '', `https://www.openstreetmap.org/?mlat=${geo.latitude}&mlon=${geo.longitude}#map=10/${geo.latitude}/${geo.longitude}`, null, geo));
                }
            }
            break;
        case 'crossref':
            for (const r of take(rec(rec(body).message).items, limit))
                items.push(article(`doi:${r.DOI}`, name, 'research', arr(r.title)[0] || r.DOI, r.publisher, r.URL, r.created?.['date-time'] || null));
            break;
        case 'worldbank':
            for (const r of take(arr(body)[1], limit)) {
                const title = `Population — ${rec(r.country).value || r.countryiso3code || 'Country'} (${r.date})`;
                items.push(article(`wb:${r.countryiso3code}:${r.date}`, name, 'statistic', title, `Population estimate: ${r.value ?? 'not reported'}`, `https://data.worldbank.org/indicator/SP.POP.TOTL?locations=${encodeURIComponent(txt(r.country?.id) || country || 'all')}`, null));
            }
            break;
        case 'govuk':
            items.push(article(`govuk:${body.content_id || query.path}`, name, 'record', body.title, body.description, 'https://www.gov.uk' + (body.base_path || query.path || '/take-pet-abroad'), body.public_updated_at));
            break;
        case 'govuk-search':
            for (const r of take(rec(body).results, limit)) {
                const path = txt(r.link || r.url);
                const url = path.startsWith('/') ? 'https://www.gov.uk' + path : path;
                items.push(article(`govuk-search:${path}`, name, 'record', r.title, r.description || r.content_store_document_type, url, r.public_timestamp || r.updated_at));
            }
            break;
        case 'uk-parliament':
            for (const r of take(rec(body).items, limit)) {
                const id = Number(r.billId ?? r.id);
                if (!Number.isInteger(id) || id < 1)
                    continue;
                items.push(article(`uk-parliament:${id}`, name, 'record', r.shortTitle || r.longTitle, `Bill in ${r.currentHouse || 'Parliament'}`, `https://bills.parliament.uk/bills/${id}`, r.lastUpdate || r.lastUpdated));
            }
            break;
        case 'congress': {
            const type: Record<string, string> = { HR: 'house-bill', S: 'senate-bill', HRES: 'house-resolution', SRES: 'senate-resolution', HJRES: 'house-joint-resolution', SJRES: 'senate-joint-resolution' };
            for (const b of take(rec(body).bills, limit)) {
                const kind = type[b.type] || 'house-bill';
                const link = `https://www.congress.gov/bill/${b.congress}th-congress/${kind}/${b.number}`;
                items.push(article(`congress:${b.congress}:${b.type}:${b.number}`, name, 'record', b.title, rec(b.latestAction).text, link, rec(b.latestAction).actionDate));
            }
            break;
        }
        case 'govinfo':
            for (const r of take(rec(body).packages, limit))
                items.push(article(`govinfo:${r.packageId}`, name, 'record', r.title || r.packageId, r.collectionName || '', `https://www.govinfo.gov/app/details/${encodeURIComponent(txt(r.packageId))}`, r.lastModified));
            break;
        case 'regulations':
            for (const r of take(rec(body).data, limit)) {
                const a = rec(r.attributes);
                items.push(article(`regulations:${r.id}`, name, 'record', a.title, a.documentType || a.agencyId, `https://www.regulations.gov/document/${encodeURIComponent(txt(r.id))}`, a.postedDate));
            }
            break;
    }
    return { provider: query.source, items: items.filter((x): x is GlobalItem => !!x), retrievedAt: new Date().toISOString() };
}
