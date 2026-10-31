'use client';
import Link from 'next/link';
import { useApp } from './Provider';
import { NewsFeed } from './NewsFeed';
import { briefs } from '@/lib/content';
import { ArrowUpRight } from './Icons';
export function NewsPage() { const { city, location } = useApp(); return <div className="page-content page-top"><div className="page-kicker">THE EQUAL HORIZONS DESK <span> / </span> {city.toUpperCase()} · {location.country.toUpperCase()}</div><div className="interior-title"><h1>The local<br /><em>wire.</em></h1><p>Local, national and global headlines. Choose any city, follow the original publisher, and revisit stories after they are archived.</p></div><div className="news-layout"><NewsFeed fallback={briefs} limit={35}/><aside className="news-aside"><span>THE DIFFERENCE</span><h3>It’s not just<br />about <em>today.</em></h3><p>Most feeds tell you what happened. We help you find the records, meetings and background that put each update in perspective.</p><Link href="/records">EXPLORE PUBLIC SOURCES <ArrowUpRight size={17}/></Link><div className="aside-line"/><b>HOW THIS FEED WORKS</b><p>Publisher headlines are retrieved from regional RSS searches and linked to their original sources. Connected editions can accumulate an archive over time. Coverage and update times depend on the source and scheduled ingestion.</p></aside></div></div>; }
