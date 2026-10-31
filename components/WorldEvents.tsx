'use client';
import { useEffect, useState } from 'react';
import type { GlobalItem } from '@/lib/world-connectors';
export function WorldEvents({ onSelect, limit = 6 }: {
    onSelect?: (item: GlobalItem) => void;
    limit?: number;
}) {
    const [events, setEvents] = useState<GlobalItem[]>([]), [status, setStatus] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');
    useEffect(() => {
        const controller = new AbortController();
        fetch('/api/world-events', { signal: controller.signal }).then(async (r) => { if (!r.ok)
            throw new Error('Upstream unavailable'); return r.json(); }).then(data => { if (controller.signal.aborted)
            return; const items: Array<GlobalItem> = Array.isArray(data.items) ? data.items : []; setEvents(items); setStatus(items.length ? 'ready' : 'empty'); }).catch(() => { if (!controller.signal.aborted)
            setStatus('error'); });
        return () => controller.abort();
    }, []);
    return <div className="eh-event-list" aria-live="polite">
  {status === 'loading' && <p className="eh-mini-note">Checking official event feeds…</p>}
  {status === 'empty' && <p className="eh-mini-note">No current geolocated events available from these sources.</p>}
  {status === 'error' && <p className="eh-mini-note">Global event feeds are temporarily unavailable. Official source links will return when providers recover.</p>}
  {events.slice(0, limit).map((e, i) => <div className="eh-event-item" key={e.id}>
   <button type="button" onClick={() => onSelect?.(e)} className="eh-event-focus" title="Locate on Earth" disabled={!e.location} aria-label={'Locate ' + e.title + ' on globe'}>{String(i + 1).padStart(2, '0')}</button>
   <div><span className="eh-event-byline">{e.source}{e.publishedAt && Number.isFinite(Date.parse(e.publishedAt)) ? ' · ' + new Date(e.publishedAt).toLocaleDateString() : ''}</span>
    <a href={e.url} target="_blank" rel="noopener noreferrer" className="eh-event-title">{e.title} <span aria-hidden="true">↗</span></a>
    <span className="eh-event-desc">{e.description}</span></div>
  </div>)}
 </div>;
}
