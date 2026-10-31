'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useApp } from './Provider';
import { topics, type Brief } from '@/lib/content';
import { newsQuery, type NewsScope } from '@/lib/location';
import type { FeedResult } from '@/lib/news';
import { ArrowUpRight, RefreshCw, AlertCircle } from './Icons';
import { SaveButton } from './SaveButton';
const relative = (date: string) => { const ms = Date.now() - Date.parse(date); if (!Number.isFinite(ms) || ms < 0)
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); const hours = Math.floor(ms / 3600000); return hours < 1 ? 'JUST NOW' : hours < 24 ? hours + 'H AGO' : Math.floor(hours / 24) + 'D AGO'; };
export function NewsFeed({ fallback = [], limit = 5, showFilters = true }: {
    fallback?: Brief[];
    limit?: number;
    showFilters?: boolean;
}) {
    const { city, location, scope, setScope } = useApp();
    const [feed, setFeed] = useState<FeedResult | null>(null), [loading, setLoading] = useState(true), [filter, setFilter] = useState('All'), [reloading, setReloading] = useState(0);
    useEffect(() => { const controller = new AbortController(); setLoading(true); setFeed(null); fetch('/api/news?' + newsQuery(location, scope), { signal: controller.signal }).then(r => r.json()).then(data => { if (!controller.signal.aborted)
        setFeed(data); }).catch(() => { if (!controller.signal.aborted)
        setFeed({ city, location, scope, stories: [], fetchedAt: new Date().toISOString(), available: false, source: 'News RSS', message: 'Headlines temporarily unavailable.' }); }).finally(() => { if (!controller.signal.aborted)
        setLoading(false); }); return () => controller.abort(); }, [location.id, scope, reloading]);
    const live = feed?.stories || [];
    const items = live.filter(x => filter === 'All' || x.category === filter).slice(0, limit);
    const docs = scope === 'local' && location.id === 'us-california-pleasanton' ? fallback.filter(x => x.city === 'Pleasanton' && (filter === 'All' || x.category === filter)).slice(0, limit) : [];
    return <section className="feed-section"><div className="section-header"><div className="section-heading"><span className="mini-bar"/><h2>{scope === 'local' ? 'THE LOCAL WIRE' : scope === 'national' ? 'THE NATIONAL WIRE' : 'THE WORLD WIRE'}</h2>{feed?.available && live.length > 0 && <span className="live-marker"><i /> NEWS SOURCES</span>}</div><div className="section-actions"><button onClick={() => setReloading(v => v + 1)} aria-label="Refresh headlines" title="Refresh headlines"><RefreshCw size={15}/></button><Link href="/news">VIEW ALL <ArrowUpRight size={15}/></Link></div></div>
 <div className="scope-tabs" role="group" aria-label="News coverage"><button className={scope === 'local' ? 'active' : ''} onClick={() => setScope('local')}>LOCAL / {location.name.toUpperCase()}</button><button className={scope === 'national' ? 'active' : ''} onClick={() => setScope('national')}>NATIONAL</button><button className={scope === 'world' ? 'active' : ''} onClick={() => setScope('world')}>WORLD</button></div>
 {showFilters && <div className="filter-row">{topics.slice(0, 7).map(t => <button key={t} className={filter === t ? 'chosen' : ''} onClick={() => setFilter(t)}>{t}</button>)}</div>}
 {loading && <div className="feed-loading"><div className="loader-line"/><div className="loader-line short"/><div className="loader-line"/><span>FETCHING {scope.toUpperCase()} HEADLINES...</span></div>}
 {!loading && items.length > 0 && <><div className="wire-list">{items.map(s => <div className="wire-item" key={s.id}><div className="wire-index">↗</div><div className="wire-copy"><div className="eyebrow-meta"><b>{s.category.toUpperCase()}</b><span>·</span><span>{s.source}</span><span>·</span><span>{relative(s.publishedAt)}</span></div><a target="_blank" rel="noopener noreferrer" href={s.url} className="wire-title">{s.title}</a><span className="wire-source">PUBLISHER HEADLINE · ORIGINAL SOURCE <Link className="context-link" href={`/stories/${encodeURIComponent(s.id)}?${newsQuery(location, scope)}`}>READ THE CONTEXT ↗</Link></span></div><SaveButton id={s.id} item={{ title: s.title, url: s.url, source: s.source, description: `Published ${s.publishedAt}` }}/></div>)}</div><div className="feed-source-note">SOURCE: {feed?.source.toUpperCase()} · {feed?.archiveEnabled ? 'ARCHIVE ENABLED' : 'RECENT HEADLINES ONLY'} · <span title="Time when Equal Horizons last fetched data">CHECKED {feed?.fetchedAt ? new Date(feed.fetchedAt).toLocaleTimeString() : ''}</span></div></>}
 {!loading && items.length === 0 && <><div className="source-status"><AlertCircle size={18}/><span>{feed?.available ? (filter === 'All' ? 'No matching news was found in this coverage area.' : 'No recent headlines in this category.') : 'Feeds are temporarily unavailable or this area has limited coverage.'}</span></div>{docs.length > 0 && <div className="wire-list">{docs.map(b => <div className="wire-item" key={b.id}><div className="wire-index">↗</div><div className="wire-copy"><div className="eyebrow-meta"><b>{b.category.toUpperCase()}</b><span>·</span><span>{b.source}</span></div><a className="wire-title" target="_blank" rel="noopener noreferrer" href={b.url}>{b.title}</a><p className="wire-excerpt">{b.description}</p><span className="wire-source">SOURCE GUIDE · NOT LIVE NEWS</span></div><SaveButton id={b.id}/></div>)}</div>}</>}
 {!loading && !items.length && !docs.length && <p className="empty-note">Try National or World, or choose another city. Feed availability varies by country and publisher.</p>}
 </section>;
}
