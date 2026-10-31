import { NextRequest, NextResponse } from 'next/server';
import { discover, isDiscoveryMode } from '@/lib/world-service';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
export async function GET(req: NextRequest) {
    const params = req.nextUrl.searchParams, mode = params.get('mode'), rawCountry = params.get('country') || '', country = rawCountry.toUpperCase();
    if (!isDiscoveryMode(mode))
        return NextResponse.json({ error: 'mode must be all, news, events, records, or archives' }, { status: 400 });
    if (country && !/^[A-Z]{2}$/.test(country))
        return NextResponse.json({ error: 'Invalid country ISO code' }, { status: 400 });
    const limit = Math.min(20, Math.max(1, Number(params.get('limit')) || 10));
    const result = await discover({ mode, country, q: params.get('q') || '', limit }, { credentials: { congress: process.env.CONGRESS_API_KEY, govinfo: process.env.GOVINFO_API_KEY, regulations: process.env.REGULATIONS_API_KEY } });
    return NextResponse.json(result, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } });
}
