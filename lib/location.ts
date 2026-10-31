export type CommunityLocation = {
    id: string;
    name: string;
    region: string;
    country: string;
    countryCode: string;
    latitude?: number;
    longitude?: number;
};
export type NewsScope = 'local' | 'national' | 'world';
export const DEFAULT_LOCATION: CommunityLocation = { id: 'us-california-pleasanton', name: 'Pleasanton', region: 'California', country: 'United States', countryCode: 'US' };
export const FEATURED_LOCATIONS: CommunityLocation[] = [
    DEFAULT_LOCATION,
    { id: 'us-california-dublin', name: 'Dublin', region: 'California', country: 'United States', countryCode: 'US' },
    { id: 'gb-england-london', name: 'London', region: 'England', country: 'United Kingdom', countryCode: 'GB' },
    { id: 'in-delhi-new-delhi', name: 'New Delhi', region: 'Delhi', country: 'India', countryCode: 'IN' },
    { id: 'jp-tokyo-tokyo', name: 'Tokyo', region: 'Tokyo', country: 'Japan', countryCode: 'JP' },
    { id: 'au-new-south-wales-sydney', name: 'Sydney', region: 'New South Wales', country: 'Australia', countryCode: 'AU' },
    { id: 'ca-ontario-toronto', name: 'Toronto', region: 'Ontario', country: 'Canada', countryCode: 'CA' },
    { id: 'br-sao-paulo-sao-paulo', name: 'São Paulo', region: 'São Paulo', country: 'Brazil', countryCode: 'BR' },
    { id: 'za-gauteng-johannesburg', name: 'Johannesburg', region: 'Gauteng', country: 'South Africa', countryCode: 'ZA' },
    { id: 'fr-ile-de-france-paris', name: 'Paris', region: 'Île-de-France', country: 'France', countryCode: 'FR' },
    { id: 'sg-singapore-singapore', name: 'Singapore', region: 'Singapore', country: 'Singapore', countryCode: 'SG' },
    { id: 'ae-dubai-dubai', name: 'Dubai', region: 'Dubai', country: 'United Arab Emirates', countryCode: 'AE' },
];
export const countryName = (code: string) => { try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code.toUpperCase()) || code;
}
catch {
    return code;
} };
export function locationId(name: string, region: string, countryCode: string) { return [countryCode, region, name].join('-').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 160); }
const safeName = (x: unknown, max = 90) => typeof x === 'string' ? x.replace(/[<>\r\n\t]/g, '').trim().slice(0, max) : '';
export function normalizeLocation(input: unknown): CommunityLocation | null {
    if (!input || typeof input !== 'object')
        return null;
    const v = input as Record<string, unknown>, name = safeName(v.name), region = safeName(v.region), code = safeName(v.countryCode, 2).toUpperCase();
    if (name.length < 2 || !/^[A-Z]{2}$/.test(code))
        return null;
    const latitude = typeof v.latitude === 'number' && Number.isFinite(v.latitude) && Math.abs(v.latitude) <= 90 ? v.latitude : undefined;
    const longitude = typeof v.longitude === 'number' && Number.isFinite(v.longitude) && Math.abs(v.longitude) <= 180 ? v.longitude : undefined;
    return { id: locationId(name, region, code), name, region, country: countryName(code), countryCode: code, ...(latitude === undefined ? {} : { latitude }), ...(longitude === undefined ? {} : { longitude }) };
}
export function locationFromQuery(params: URLSearchParams): CommunityLocation {
    return normalizeLocation({ name: params.get('city') || DEFAULT_LOCATION.name, region: params.get('region') || (params.has('city') ? '' : DEFAULT_LOCATION.region), countryCode: params.get('country') || DEFAULT_LOCATION.countryCode }) || DEFAULT_LOCATION;
}
export function newsQuery(location: CommunityLocation, scope: NewsScope) { return new URLSearchParams({ city: location.name, region: location.region, country: location.countryCode, scope }).toString(); }
export const isPleasanton = (loc: CommunityLocation) => loc.name.toLowerCase() === 'pleasanton' && loc.countryCode === 'US' && loc.region.toLowerCase() === 'california';
export const isNewsScope = (x: unknown): x is NewsScope => x === 'local' || x === 'national' || x === 'world';
