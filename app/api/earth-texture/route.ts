import { NextRequest, NextResponse } from 'next/server';
const SOURCES = {
    day: 'https://www.solarsystemscope.com/textures/download/2k_earth_daymap.jpg',
    night: 'https://www.solarsystemscope.com/textures/download/2k_earth_nightmap.jpg',
    clouds: 'https://www.solarsystemscope.com/textures/download/2k_earth_clouds.jpg'
} as const;
export const runtime = 'nodejs';
export async function GET(request: NextRequest) {
    const layer = request.nextUrl.searchParams.get('layer');
    if (layer !== 'day' && layer !== 'night' && layer !== 'clouds')
        return NextResponse.json({ error: 'Invalid texture layer' }, { status: 400 });
    try {
        const response = await fetch(SOURCES[layer], { signal: AbortSignal.timeout(12000), next: { revalidate: 604800 } });
        if (!response.ok)
            throw new Error('Upstream unavailable');
        const type = response.headers.get('content-type') || '';
        if (!type.startsWith('image/'))
            throw new Error('Unexpected content type');
        const bytes = await response.arrayBuffer();
        if (bytes.byteLength > 12000000 || bytes.byteLength < 5000)
            throw new Error('Invalid texture size');
        return new NextResponse(bytes, { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800', 'X-Content-Type-Options': 'nosniff' } });
    }
    catch {
        return NextResponse.json({ error: 'Satellite imagery temporarily unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
}
