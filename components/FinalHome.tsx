'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { coordinatesFor, HOME_PLACES } from '@/lib/globe-places';
import { newsQuery, type CommunityLocation } from '@/lib/location';
import type { GlobalItem } from '@/lib/world-connectors';
import { useApp } from './Provider';
import { HomeGlobe, type HomeGlobeHandle } from './HomeGlobe';
import { NewsFeed } from './NewsFeed';
import { WorldEvents } from './WorldEvents';
import { GlobalSourcesExplorer } from './GlobalSourcesExplorer';
import { LocationPicker } from './LocationPicker';
type Headline = {
    title: string;
    source: string;
    url: string;
};
function validHeadline(value: unknown): value is Headline {
    if (!value || typeof value !== 'object')
        return false;
    const item = value as Partial<Headline>;
    if (typeof item.title !== 'string' || typeof item.source !== 'string')
        return false;
    if (typeof item.url !== 'string')
        return false;
    try {
        return ['https:', 'http:'].includes(new URL(item.url).protocol);
    }
    catch {
        return false;
    }
}
export function FinalHome() {
    const router = useRouter();
    const { location, setLocation, scope, setScope } = useApp();
    const globe = useRef<HomeGlobeHandle>(null);
    const [selectedPlace, setSelectedPlace] = useState('Planet Earth');
    const [query, setQuery] = useState('');
    const [headlines, setHeadlines] = useState<Headline[]>([]);
    useEffect(() => {
        const controller = new AbortController();
        const url = '/api/news?' + newsQuery(location, 'world');
        fetch(url, { signal: controller.signal })
            .then(async (response) => {
            if (!response.ok)
                throw new Error('Publisher feed is temporarily unavailable');
            return response.json();
        })
            .then(data => {
            if (controller.signal.aborted)
                return;
            setHeadlines(Array.isArray(data.stories)
                ? data.stories.filter(validHeadline).slice(0, 5)
                : []);
        })
            .catch(() => {
            if (!controller.signal.aborted)
                setHeadlines([]);
        });
        return () => controller.abort();
    }, [location.id]);
    function focus(latitude: number, longitude: number, label: string) {
        setSelectedPlace(label);
        globe.current?.focus(latitude, longitude);
    }
    function selectLocation(place: CommunityLocation) {
        setLocation(place);
        setScope('local');
        const point = coordinatesFor(place);
        if (point)
            focus(point[0], point[1], place.name);
    }
    function openEvent(event: GlobalItem) {
        if (!event.location)
            return;
        focus(event.location.latitude, event.location.longitude, event.title);
        document.getElementById('world-globe')?.scrollIntoView({ behavior: 'smooth' });
    }
    function submitSearch(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const text = query.trim();
        if (text)
            router.push(`/search?q=${encodeURIComponent(text)}`);
    }
    return (<div className="eh-edition">
      <section className="eh-edition-hero" id="world-globe">
        <div className="eh-edition-hero-grid">
          <div className="eh-edition-lead">
            <div className="eh-edition-eyebrow">
              <span className="eh-edition-signal"/> Independent. Global. Local.
            </div>
            <div className="eh-edition-lead-main">
              <h1>There’s more<br />to every <em>story.</em></h1>
              <p>
                Headlines are only the beginning. Explore what’s happening now,
                find the original documents, and discover how it all connects to a place.
              </p>
              <form className="eh-edition-search" onSubmit={submitSearch} role="search">
                <input value={query} onChange={event => setQuery(event.target.value)} aria-label="Search news and records" placeholder="Search places, stories, public records"/>
                <button aria-label="Search" type="submit">↗</button>
              </form>
              <div className="eh-edition-lead-links">
                <Link href="/news">Read the latest <span>↗</span></Link>
                <Link href="/records">Find a document <span>↗</span></Link>
              </div>
            </div>
            <div className="eh-edition-lead-foot">
              <span>PUBLIC KNOWLEDGE, IN ONE PLACE</span>
              <span>SCROLL TO EXPLORE ↓</span>
            </div>
          </div>
          <HomeGlobe ref={globe} place={selectedPlace}/>
        </div>
      </section>

      <div className="eh-edition-placebar">
        <span>GO SOMEWHERE</span>
        <div className="eh-edition-place-list">
          {HOME_PLACES.map(place => (<button key={place.id} type="button" className={place.id === location.id ? 'selected' : ''} aria-pressed={place.id === location.id} onClick={() => selectLocation(place)}>
              {place.name}
            </button>))}
        </div>
        <LocationPicker compact/>
      </div>

      <div className="eh-edition-breaking" role="region" aria-label="Recent headlines">
        <span className="eh-edition-breaking-label"><i /> Latest</span>
        <div className="eh-edition-breaking-scroll">
          {headlines.length ? (<div className="eh-edition-breaking-track">
              {headlines.map(story => (<a key={story.url} href={story.url} target="_blank" rel="noopener noreferrer">
                  <span>{story.source}</span>{story.title} ↗
                </a>))}
            </div>) : (<span className="eh-edition-no-news">
              News is fetched from publishers. <Link href="/news">Open the latest feed ↗</Link>
            </span>)}
        </div>
      </div>

      <section className="eh-edition-section" id="latest-news">
        <div className="eh-edition-section-top">
          <span>THE CURRENT EDITION / 01</span>
          <Link href="/news">ALL HEADLINES ↗</Link>
        </div>
        <div className="eh-edition-section-intro">
          <h2>The world is<br /><em>still happening.</em></h2>
          <p>Real headlines, from their original publishers. Choose a place or change the scope to get closer to what matters.</p>
        </div>
        <div className="eh-edition-tabs">
          <span>NOW READING / {location.name.toUpperCase()}</span>
          <div>
            {(['world', 'national', 'local'] as const).map(value => (<button key={value} type="button" onClick={() => setScope(value)} className={scope === value ? 'active' : ''} aria-pressed={scope === value}>
                {value}
              </button>))}
          </div>
        </div>
        <NewsFeed limit={7} showFilters={false}/>
      </section>

      <section className="eh-edition-section eh-edition-event-section" id="world-events">
        <div className="eh-edition-section-top">
          <span>THE WORLD IN MOTION / 02</span>
          <Link href="/explore">EXPLORE PLACES ↗</Link>
        </div>
        <div className="eh-edition-section-intro">
          <h2>It happened<br /><em>somewhere.</em></h2>
          <p>Earthquakes, storms, and natural events with real coordinates. Select one to locate it on the globe.</p>
        </div>
        <WorldEvents onSelect={openEvent} limit={8}/>
      </section>

      <section className="eh-edition-section eh-edition-docs-section" id="record-index">
        <div className="eh-edition-section-top">
          <span>THE ORIGINAL SOURCE / 03</span>
          <Link href="/records">ALL RECORDS ↗</Link>
        </div>
        <div className="eh-edition-section-intro">
          <h2>Go beyond<br /><em>the headline.</em></h2>
          <p>Find legislation, government publications, and historical materials—then follow the original source. Coverage varies by country.</p>
        </div>
        <GlobalSourcesExplorer limit={12} mode="records"/>
      </section>

      <section className="eh-edition-endnote">
        <div>
          <span>WHAT WE BELIEVE</span>
          <h2>Context belongs<br />to everyone.</h2>
        </div>
        <div>
          <p>Better information begins with a source you can check. Equal Horizons is building a public record of what happened, where, and why it matters.</p>
          <Link href="/about">Learn about the project ↗</Link>
        </div>
      </section>
    </div>);
}
