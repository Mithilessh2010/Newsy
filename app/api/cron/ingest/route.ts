import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { FEATURED_LOCATIONS, normalizeLocation, type NewsScope } from '@/lib/location';
import { getNews } from '@/lib/news';
import { archiveRows } from '@/lib/ingestion';
export const maxDuration = 60;
type QueueRecord = {
    location_key?: string;
    feed_key?: string;
    city: string;
    region: string;
    country_code: string;
    scope?: NewsScope;
};
export async function GET(req: NextRequest) {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
    const dbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!dbUrl || !key)
        return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    const sb = createClient(dbUrl, key, { auth: { persistSession: false } });
    const now = new Date().toISOString();
    const seeds = FEATURED_LOCATIONS.map(l => ({ location_key: l.id, city: l.name, region: l.region, country_code: l.countryCode }));
    const uniqueCountries = new Map(FEATURED_LOCATIONS.map(l => [l.countryCode, l]));
    const wideSeeds = [{ feed_key: 'world', scope: 'world', city: 'Worldwide', region: '', country_code: 'US' },
        ...[...uniqueCountries.values()].map(l => ({ feed_key: 'national:' + l.countryCode, scope: 'national', city: l.name, region: l.region, country_code: l.countryCode }))];
    const [a, b] = await Promise.all([
        sb.from('monitored_locations').upsert(seeds, { onConflict: 'location_key', ignoreDuplicates: true }),
        sb.from('monitored_feeds').upsert(wideSeeds, { onConflict: 'feed_key', ignoreDuplicates: true })
    ]);
    if (a.error || b.error)
        return NextResponse.json({ error: 'Database seed failure; apply sql/reliability.sql', detail: a.error?.message || b.error?.message }, { status: 503 });
    const [localClaim, wideClaim] = await Promise.all([
        sb.rpc('claim_local_ingestion', { p_limit: 8 }), sb.rpc('claim_wide_ingestion', { p_limit: 4 })
    ]);
    if (localClaim.error || wideClaim.error)
        return NextResponse.json({ error: 'Queue unavailable; apply sql/reliability.sql', detail: localClaim.error?.message || wideClaim.error?.message }, { status: 503 });
    const claimed: [
        QueueRecord,
        NewsScope,
        'monitored_locations' | 'monitored_feeds',
        string
    ][] = [
        ...(localClaim.data || []).map((r: QueueRecord) => [r, 'local', 'monitored_locations', r.location_key!] as [
            QueueRecord,
            NewsScope,
            'monitored_locations',
            string
        ]),
        ...(wideClaim.data || []).map((r: QueueRecord) => [r, r.scope === 'world' ? 'world' : 'national', 'monitored_feeds', r.feed_key!] as [
            QueueRecord,
            NewsScope,
            'monitored_feeds',
            string
        ])
    ];
    const polled = await Promise.all(claimed.map(async ([record, scope, table, id]) => {
        const location = scope === 'world' ? FEATURED_LOCATIONS[0] : normalizeLocation({ name: record.city, region: record.region, countryCode: record.country_code });
        let count = 0, ok = false, errorMessage: string | undefined;
        try {
            if (!location)
                throw new Error('Malformed queue location');
            const feed = await getNews(location, scope);
            if (!feed.available)
                throw new Error('Publisher feed unavailable');
            const rows = archiveRows(feed.stories, location, scope, now);
            count = rows.length;
            if (rows.length) {
                const result = await sb.from('news_items').upsert(rows, { onConflict: 'id' });
                if (result.error)
                    throw new Error(result.error.message);
            }
            ok = true;
        }
        catch (error) {
            errorMessage = error instanceof Error ? error.message : 'Unknown upstream error';
        }
        const update = await sb.from(table).update({ last_checked_at: now, last_status: ok ? 'ok' : 'error', last_count: count, lease_until: null }).eq(table === 'monitored_locations' ? 'location_key' : 'feed_key', id);
        if (update.error) {
            ok = false;
            errorMessage = 'Unable to persist poll status: ' + update.error.message;
        }
        return { scope, city: record.city, country: record.country_code, count, ok, ...(errorMessage ? { error: errorMessage } : {}) };
    }));
    const failed = polled.filter(p => !p.ok).length;
    return NextResponse.json({ completedAt: now, polled, failed, claimed: claimed.length }, {
        status: failed ? 207 : 200, headers: { 'Cache-Control': 'no-store' }
    });
}
