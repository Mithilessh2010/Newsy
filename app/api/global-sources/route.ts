import { NextResponse } from 'next/server';
import { fetchGlobalSource, isSource, ProviderError } from '../../../lib/world-connectors';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
    const url = new URL(req.url);
    const source = url.searchParams.get('source') || '';
    if (!isSource(source))
        return NextResponse.json({ error: 'Specify a supported source ID', example: '/api/global-sources?source=gdelt&q=climate' }, { status: 400 });
    try {
        const result = await fetchGlobalSource({
            source,
            q: url.searchParams.get('q') || '',
            country: url.searchParams.get('country') || '',
            path: url.searchParams.get('path') || undefined,
            limit: Number(url.searchParams.get('limit') || 10)
        }, { credentials: {
                congress: process.env.CONGRESS_API_KEY,
                govinfo: process.env.GOVINFO_API_KEY,
                regulations: process.env.REGULATIONS_API_KEY
            } });
        return NextResponse.json(result, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900' } });
    }
    catch (err) {
        const e = err instanceof ProviderError ? err : new ProviderError('UPSTREAM_UNAVAILABLE', 'Provider request failed');
        return NextResponse.json({ error: e.message, code: e.code }, { status: e.code === 'INVALID_INPUT' ? 400 : e.code === 'NOT_CONFIGURED' ? 503 : 502, headers: { 'Cache-Control': 'no-store' } });
    }
}
