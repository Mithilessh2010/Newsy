import { NextRequest, NextResponse } from 'next/server';
import { normalizeLocation } from '@/lib/location';
export function GET(req: NextRequest) {
    const country = req.headers.get('x-vercel-ip-country');
    const name = req.headers.get('x-vercel-ip-city');
    let region = req.headers.get('x-vercel-ip-country-region') || '';
    if (country === 'US' && region === 'CA')
        region = 'California';
    let city = '';
    try {
        city = decodeURIComponent(name || '');
    }
    catch {
        city = name || '';
    }
    const location = normalizeLocation({ name: city, region, countryCode: country });
    return NextResponse.json({ location, confidence: location ? 'approximate-ip-city' : 'unknown', message: 'IP-derived city is approximate; select your city for accurate coverage.' }, { headers: { 'Cache-Control': 'private, no-store' } });
}
