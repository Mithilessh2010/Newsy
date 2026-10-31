import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { discover } from '@/lib/world-service';
import type { GlobalItem } from '@/lib/world-connectors';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
export async function GET() {
    const live = await discover({ mode: 'events', limit: 12, sources: ['usgs', 'nasa-eonet', 'gdacs'] });
    let archived: GlobalItem[] = [];
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key)
        try {
            const sb = createClient(url, key, { auth: { persistSession: false } });
            const { data, error } = await sb.from('global_items').select('id,source,category,title,description,url,published_at,latitude,longitude').eq('category', 'event').order('published_at', { ascending: false }).limit(40);
            if (!error)
                archived = (data || []).map(x => ({ id: x.id, source: x.source, category: 'event', title: x.title, description: x.description, url: x.url, publishedAt: x.published_at, ...(typeof x.latitude === 'number' && typeof x.longitude === 'number' ? { location: { latitude: x.latitude, longitude: x.longitude } } : {}) }));
        }
        catch { }
    const seen = new Set<string>();
    const items = [...live.items, ...archived].filter(x => {
        if (!x.location || !Number.isFinite(x.location.latitude) || !Number.isFinite(x.location.longitude) || seen.has(x.id))
            return false;
        seen.add(x.id);
        return true;
    }).sort((a, b) => Date.parse(b.publishedAt || '') - Date.parse(a.publishedAt || '')).slice(0, 30);
    return NextResponse.json({ items, sources: live.sources, retrievedAt: live.retrievedAt, archiveEnabled: !!(url && key) }, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } });
}
