import { createClient } from '@supabase/supabase-js';
import { getNews, type FeedItem } from '@/lib/news';
import { locationFromQuery, isNewsScope, isPleasanton } from '@/lib/location';
import { recordsForLocation } from '@/lib/global-records';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowUpRight, FileText } from '@/components/Icons';
import { SaveButton } from '@/components/SaveButton';
export const dynamic = 'force-dynamic';
export default async function Page({ params, searchParams }: {
    params: Promise<{
        id: string;
    }>;
    searchParams: Promise<{
        city?: string;
        country?: string;
        region?: string;
        scope?: string;
    }>;
}) {
    const { id } = await params, p = await searchParams;
    const loc = locationFromQuery(new URLSearchParams(p as Record<string, string>));
    const scope = isNewsScope(p.scope) ? p.scope : 'local';
    let story: FeedItem | undefined;
    const dbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (dbUrl && key) {
        try {
            const sb = createClient(dbUrl, key, { auth: { persistSession: false } });
            const { data } = await sb.from('news_items').select('id,title,publisher,url,published_at,category,city,country_code,scope').eq('id', decodeURIComponent(id)).maybeSingle();
            if (data) {
                story = { id: data.id, title: data.title, source: data.publisher, url: data.url, publishedAt: data.published_at, category: data.category, city: data.city, countryCode: data.country_code, scope: data.scope };
            }
        }
        catch { }
    }
    if (!story) {
        const news = await getNews(loc, scope);
        story = news.stories.find(s => s.id === decodeURIComponent(id));
    }
    if (!story) {
        notFound();
        throw new Error('Story unavailable');
    }
    const related = recordsForLocation(loc).filter(r => r.category === story.category || r.category === 'Government').slice(0, 4);
    return <div className="page-content page-top story-page"><Link href="/news" className="back-link">← THE NEWS WIRE</Link><div className="page-kicker">{story.category.toUpperCase()} / {loc.name.toUpperCase()} / REPORTED BY {story.source.toUpperCase()}</div><div className="interior-title"><h1>{story.title}</h1><p>From the original publisher to the primary record. Explore the reporting, source links and what we can verify.</p></div><div className="story-page-actions"><a href={story.url} target="_blank" rel="noopener noreferrer" className="account-action">READ AT ORIGINAL PUBLISHER <ArrowUpRight size={18}/></a><SaveButton id={story.id} large item={{ title: story.title, url: story.url, source: story.source, description: 'Publisher headline' }}/><span>PUBLISHED {new Date(story.publishedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span></div><div className="story-context"><div><span className="overline">01 / WHAT WE CAN VERIFY</span><h2>Start with<br /><em>the source.</em></h2><p>Headline and publication metadata come from the source feed or our dated archive. We do not reproduce the full original article or manufacture a summary when the underlying content cannot be verified. Read the publisher's coverage directly.</p></div><div><span className="overline">02 / THE PUBLIC PAPER TRAIL</span><h2>Go a little<br /><em>deeper.</em></h2><p>These are public-data entry points and broad topic matches—not evidence that a particular record confirms this headline. City-specific archival depth varies by location.</p><div className="related-records">{related.map(r => <div className="related-row" key={r.id}><FileText size={21}/><div><a href={r.url} target="_blank" rel="noopener noreferrer">{r.title} <ArrowUpRight size={17}/></a><span>{r.agency}</span></div><SaveButton id={r.id}/></div>)}</div><Link className="square-link" href={isPleasanton(loc) ? '/timelines' : '/records'}>EXPLORE ORIGINAL SOURCES <ArrowUpRight size={17}/></Link></div></div></div>;
}
