import { NextRequest, NextResponse } from 'next/server';
import { normalizeLocation } from '@/lib/location';
export const maxDuration = 15;
type GeoResult = {
    name?: string;
    admin1?: string;
    country_code?: string;
    latitude?: number;
    longitude?: number;
};
export async function GET(req: NextRequest) {
    const q = (req.nextUrl.searchParams.get('q') || '').trim().slice(0, 90);
    if (q.length < 2)
        return NextResponse.json({ results: [], message: 'Enter at least two characters.' });
    try {
        const endpoint = 'https://geocoding-api.open-meteo.com/v1/search?' + new URLSearchParams({ name: q, count: '12', language: 'en', format: 'json' });
        const r = await fetch(endpoint, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(7000) });
        if (!r.ok)
            throw new Error('Location provider unavailable');
        const data = await r.json() as {
            results?: GeoResult[];
        };
        const seen = new Set<string>();
        const results = (data.results || []).map(p => normalizeLocation({ name: p.name, region: p.admin1 || '', countryCode: p.country_code, latitude: p.latitude, longitude: p.longitude })).filter((x) => { if (!x || seen.has(x.id))
            return false; seen.add(x.id); return true; });
        return NextResponse.json({ results, provider: 'Open-Meteo geocoding' }, { headers: { 'Cache-Control': 'public, s-maxage=86400' } });
    }
    catch {
        return NextResponse.json({ results: [], message: 'City search is temporarily unavailable.' }, { status: 502 });
    }
}
