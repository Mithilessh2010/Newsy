import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { discover } from '@/lib/world-service';
import type { GlobalItem } from '@/lib/world-connectors';
export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';
export const ARCHIVE_SOURCES = ['gdelt', 'usgs', 'nasa-eonet', 'federal-register', 'loc', 'crossref'] as const;
export function toArchiveRow(item: GlobalItem, now: string) {
    return { id: item.id, source: item.source, category: item.category, title: item.title, description: item.description, url: item.url, published_at: item.publishedAt && Number.isFinite(Date.parse(item.publishedAt)) ? item.publishedAt : now,
        latitude: item.location?.latitude ?? null, longitude: item.location?.longitude ?? null, last_seen_at: now };
}
export async function GET(req: NextRequest) {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
    const dbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!dbUrl || !key)
        return NextResponse.json({ error: 'Supabase backend is not configured' }, { status: 503 });
    const sb = createClient(dbUrl, key, { auth: { persistSession: false } });
    const slot = Math.floor(Date.now() / 900000) % 3;
    const batches = [['gdelt', 'usgs'], ['nasa-eonet', 'federal-register'], ['loc', 'crossref']] as const;
    const sources = [...batches[slot]];
    const data = await discover({ mode: 'all', limit: 20, sources: [...sources] });
    const now = new Date().toISOString();
    const rows = data.items.filter(item => item.category !== 'place').map(item => toArchiveRow(item, now));
    let inserted = 0;
    let error: string | null = null;
    if (rows.length) {
        const response = await sb.from('global_items').upsert(rows, { onConflict: 'id' });
        if (response.error)
            error = 'Database write failed: ' + response.error.message;
        else
            inserted = rows.length;
    }
    const log = await sb.from('source_runs').insert({ run_at: now, source_ids: sources, records_seen: rows.length, records_stored: inserted, failures: data.sources.filter(x => x.status !== 'ok').map(x => x.id), status: error ? 'error' : 'completed' });
    if (log.error && !error)
        error = 'Source run log failed: ' + log.error.message;
    const allFailed = data.sources.length > 0 && data.sources.every(s => s.status !== 'ok');
    return NextResponse.json({ completedAt: now, sources: data.sources, archived: inserted, ...(error ? { error } : {}) }, { status: error ? 503 : allFailed ? 502 : 200, headers: { 'Cache-Control': 'no-store' } });
}
