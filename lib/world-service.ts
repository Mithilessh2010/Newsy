import { fetchGlobalSource, type GlobalItem, type GlobalResult, type GlobalSourceId, } from './world-connectors';
export type DiscoveryMode = 'all' | 'news' | 'events' | 'records' | 'archives';
export type SourceState = 'ok' | 'unavailable' | 'not_configured';
export type DiscoveryResponse = {
    items: GlobalItem[];
    sources: {
        id: GlobalSourceId;
        status: SourceState;
        count: number;
    }[];
    retrievedAt: string;
};
type DiscoverOptions = {
    mode: DiscoveryMode;
    q?: string;
    country?: string;
    limit?: number;
    sources?: GlobalSourceId[];
};
type DiscoverDependencies = {
    fetcher?: typeof fetch;
    credentials?: {
        congress?: string;
        govinfo?: string;
        regulations?: string;
    };
};
export const DISCOVERY_SOURCES: Record<DiscoveryMode, GlobalSourceId[]> = {
    all: ['gdelt', 'usgs', 'nasa-eonet', 'federal-register', 'loc', 'crossref'],
    news: ['gdelt'],
    events: ['usgs', 'nasa-eonet', 'gdacs'],
    records: [
        'federal-register', 'govuk-search', 'uk-parliament',
        'congress', 'govinfo', 'regulations', 'loc', 'crossref',
    ],
    archives: ['loc', 'crossref', 'worldbank'],
};
export const VALID_SOURCES = new Set<GlobalSourceId>([
    'gdelt', 'usgs', 'nasa-eonet', 'gdacs', 'federal-register',
    'loc', 'open-meteo-places', 'crossref', 'worldbank', 'govuk',
    'congress', 'govinfo', 'regulations', 'govuk-search', 'uk-parliament',
]);
export function isDiscoveryMode(value: string | null): value is DiscoveryMode {
    return value !== null && Object.hasOwn(DISCOVERY_SOURCES, value);
}
function relevantSources(mode: DiscoveryMode, country: string): GlobalSourceId[] {
    if (mode !== 'records')
        return DISCOVERY_SOURCES[mode];
    switch (country) {
        case 'US':
            return ['federal-register', 'congress', 'govinfo', 'regulations', 'loc'];
        case 'GB':
            return ['govuk-search', 'uk-parliament', 'loc', 'crossref'];
        default:
            return ['loc', 'crossref'];
    }
}
function permittedForCountry(source: GlobalSourceId, country: string): boolean {
    if (!country)
        return true;
    if (['congress', 'govinfo', 'regulations', 'federal-register'].includes(source)) {
        return country === 'US';
    }
    if (['govuk', 'govuk-search', 'uk-parliament'].includes(source)) {
        return country === 'GB';
    }
    return true;
}
function publishedTime(item: GlobalItem): number {
    const parsed = Date.parse(item.publishedAt || '');
    return Number.isFinite(parsed) ? parsed : 0;
}
export async function discover(options: DiscoverOptions, dependencies: DiscoverDependencies = {}): Promise<DiscoveryResponse> {
    const q = (options.q || '').trim().slice(0, 100);
    const country = (options.country || '').trim().toUpperCase();
    if (country && !/^[A-Z]{2}$/.test(country)) {
        throw new RangeError('country must be an ISO 3166-1 alpha-2 code');
    }
    const limit = Number.isFinite(options.limit)
        ? Math.max(1, Math.min(20, Math.floor(options.limit!)))
        : 10;
    const requested = options.sources ?? relevantSources(options.mode, country);
    const selected = [...new Set(requested)]
        .filter(source => VALID_SOURCES.has(source) && permittedForCountry(source, country))
        .slice(0, 6);
    if (!selected.length)
        selected.push('loc', 'crossref');
    const responses = await Promise.all(selected.map(async (source) => {
        try {
            const response: GlobalResult = await fetchGlobalSource({
                source,
                q,
                country: source === 'worldbank' ? country : undefined,
                limit,
            }, dependencies);
            return { id: source, status: 'ok' as const, items: response.items };
        }
        catch (error) {
            const missingKey = error instanceof Error
                && 'code' in error && error.code === 'NOT_CONFIGURED';
            return {
                id: source,
                status: (missingKey ? 'not_configured' : 'unavailable') as SourceState,
                items: [] as GlobalItem[],
            };
        }
    }));
    const seen = new Set<string>();
    const items = responses
        .flatMap(result => result.items)
        .filter(item => {
        const url = item.url.toLowerCase().split('#')[0].replace(/\/$/, '');
        if (!url || seen.has(url))
            return false;
        seen.add(url);
        return true;
    })
        .sort((a, b) => publishedTime(b) - publishedTime(a))
        .slice(0, limit);
    return {
        items,
        sources: responses.map(({ id, status, items: rows }) => ({
            id,
            status,
            count: rows.length,
        })),
        retrievedAt: new Date().toISOString(),
    };
}
