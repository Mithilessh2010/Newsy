import type { RecordItem } from './content';
import { type CommunityLocation, isPleasanton } from './location';
import { records } from './content';
const portals: Record<string, {
    name: string;
    url: string;
}> = {
    US: { name: 'Data.gov — US government open data', url: 'https://data.gov/' },
    GB: { name: 'data.gov.uk — UK public datasets', url: 'https://www.data.gov.uk/' },
    IN: { name: 'Open Government Data Platform India', url: 'https://www.data.gov.in/' },
    AU: { name: 'data.gov.au — Australian government datasets', url: 'https://data.gov.au/' },
    CA: { name: 'Open Government Portal — Canada', url: 'https://open.canada.ca/en/open-data' },
    FR: { name: 'data.gouv.fr — French public data', url: 'https://www.data.gouv.fr/' },
    DE: { name: 'GovData — Germany', url: 'https://www.govdata.de/' },
    BR: { name: 'Portal Brasileiro de Dados Abertos', url: 'https://dados.gov.br/' },
    SG: { name: 'data.gov.sg — Singapore public data', url: 'https://data.gov.sg/' },
    JP: { name: 'e-Stat — Government Statistics of Japan', url: 'https://www.e-stat.go.jp/en' },
    NZ: { name: 'data.govt.nz — New Zealand government datasets', url: 'https://www.data.govt.nz/' },
};
export function recordsForLocation(loc: CommunityLocation): RecordItem[] {
    const local = isPleasanton(loc) ? records : [];
    const portal = portals[loc.countryCode];
    const official: RecordItem[] = portal ? [{ id: 'portal-' + loc.countryCode, title: portal.name, agency: loc.country + ' government', category: 'Government', description: 'Verified starting point for national public datasets. This is an external official portal, not a locally indexed document archive.', year: 2026, city: loc.name, url: portal.url, type: 'National open data portal' }] : [];
    return [...local, ...official, { id: 'portal-worldbank', title: 'World Bank Open Data Catalog', agency: 'World Bank', category: 'Community', description: 'Internationally comparable public datasets and research from countries around the world; external data catalog.', year: 2026, city: loc.name, url: 'https://datacatalog.worldbank.org/', type: 'International data catalog' }];
}
export function canShowLocalArchive(loc: CommunityLocation) { return isPleasanton(loc); }
