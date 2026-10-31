'use client';
import { useEffect, useState, type FormEvent } from 'react';
import type { GlobalItem, GlobalSourceId } from '@/lib/world-connectors';
import { useApp } from './Provider';
import { SaveButton } from './SaveButton';
type SourceMode = 'all' | 'news' | 'events' | 'records' | 'archives';
type SourceStatus = {
    id: GlobalSourceId;
    status: 'ok' | 'unavailable' | 'not_configured';
    count: number;
};
type DiscoveryResult = {
    items: GlobalItem[];
    sources: SourceStatus[];
    retrievedAt: string;
};
type Props = {
    mode?: SourceMode;
    limit?: number;
};
const availableModes: SourceMode[] = ['records', 'news', 'events', 'archives', 'all'];
function readableMode(mode: SourceMode) {
    return mode === 'all' ? 'All sources' : mode[0].toUpperCase() + mode.slice(1);
}
function formatPublishedDate(date?: string | null) {
    if (!date || !Number.isFinite(Date.parse(date)))
        return null;
    return new Date(date).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}
export function GlobalSourcesExplorer({ mode: initialMode = 'records', limit = 16 }: Props) {
    const { location } = useApp();
    const [mode, setMode] = useState<SourceMode>(initialMode);
    const [query, setQuery] = useState('');
    const [submitted, setSubmitted] = useState('');
    const [result, setResult] = useState<DiscoveryResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [refresh, setRefresh] = useState(0);
    const [error, setError] = useState('');
    useEffect(() => {
        const controller = new AbortController();
        const parameters = new URLSearchParams({
            mode,
            q: submitted,
            country: location.countryCode,
            limit: String(Math.min(limit, 20)),
        });
        setLoading(true);
        setError('');
        setResult(null);
        fetch(`/api/discover?${parameters.toString()}`, { signal: controller.signal })
            .then(async (response) => {
            if (!response.ok)
                throw new Error('The source service is unavailable.');
            return response.json() as Promise<DiscoveryResult>;
        })
            .then(data => {
            if (!controller.signal.aborted)
                setResult(data);
        })
            .catch((reason: unknown) => {
            if (!controller.signal.aborted) {
                setError(reason instanceof Error ? reason.message : 'Sources are unavailable.');
            }
        })
            .finally(() => {
            if (!controller.signal.aborted)
                setLoading(false);
        });
        return () => controller.abort();
    }, [mode, submitted, location.countryCode, limit, refresh]);
    function search(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSubmitted(query.trim().slice(0, 100));
    }
    const healthySources = result?.sources.filter(source => source.status === 'ok').length ?? 0;
    const sourceProblems = result?.sources.filter(source => source.status !== 'ok') ?? [];
    return (<section className="eh-source-explorer" aria-label="Search public sources">
      <form className="eh-source-search" onSubmit={search} role="search">
        <input value={query} onChange={event => setQuery(event.target.value)} aria-label="Search public sources" placeholder="Search public records, events and archives"/>
        <button type="submit">Search ↗</button>
      </form>

      <div className="eh-source-tabs" role="group" aria-label="Source type">
        {availableModes.map(option => (<button key={option} type="button" className={mode === option ? 'active' : ''} aria-pressed={mode === option} onClick={() => setMode(option)}>
            {readableMode(option)}
          </button>))}
      </div>

      {loading && <p className="eh-mini-note" role="status">Contacting original sources…</p>}
      {error && <div className="eh-mini-note" role="alert">
          {error} <button type="button" className="eh-source-retry" onClick={() => setRefresh(value => value + 1)}>Try again</button>
        </div>}

      {!loading && result && (<>
          <div className="eh-source-status">
            {result.items.length} result{result.items.length === 1 ? '' : 's'} ·{' '}
            {healthySources}/{result.sources.length} sources responding
            <span> · Original publisher links only</span>
          </div>

          {result.items.length === 0 && (<p className="eh-mini-note">
              No matching records found from responding sources. Try another country,
              a broader search, or a different category.
            </p>)}

          <div className="eh-source-results">
            {result.items.map(item => {
                const published = formatPublishedDate(item.publishedAt);
                return (<article key={item.id} className="eh-source-item">
                  <div>
                    <span className="eh-event-byline">
                      {item.category.toUpperCase()} · {item.source}
                      {published ? ` · ${published}` : ''}
                    </span>
                    <a href={item.url} target="_blank" rel="noopener noreferrer">
                      {item.title} ↗
                    </a>
                    {item.description && <p>{item.description}</p>}
                  </div>
                  <SaveButton id={item.id} item={{
                        title: item.title,
                        url: item.url,
                        source: item.source,
                        description: item.description,
                    }}/>
                </article>);
            })}
          </div>

          {result.sources.some(source => source.status !== 'ok') && (<p className="eh-mini-note">
              Some sources are unavailable or need credentials. Their results aren't shown.
            </p>)}
        </>)}
    </section>);
}
