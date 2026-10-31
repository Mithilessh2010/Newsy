'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { ArrowUpRight, Menu, Search, X } from 'lucide-react';
import { useApp } from './Provider';
const navigation = [
    { href: '/news', label: 'News' },
    { href: '/explore', label: 'Explore' },
    { href: '/records', label: 'Public records' },
    { href: '/timelines', label: 'Archive' },
    { href: '/about', label: 'Our mission' },
];
export function SiteHeader() {
    const pathname = usePathname();
    const router = useRouter();
    const { user } = useApp();
    const [menuOpen, setMenuOpen] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const [query, setQuery] = useState('');
    useEffect(() => {
        const onEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setMenuOpen(false);
                setSearchOpen(false);
            }
        };
        document.addEventListener('keydown', onEscape);
        return () => document.removeEventListener('keydown', onEscape);
    }, []);
    const search = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const term = query.trim();
        if (!term)
            return;
        router.push(`/search?q=${encodeURIComponent(term)}`);
        setSearchOpen(false);
        setMenuOpen(false);
    };
    return (<>
      <header className="eh-shell-header">
        <div className="eh-shell-inner">
          <Link className="eh-shell-logo" href="/" onClick={() => setMenuOpen(false)} aria-label="Equal Horizons homepage">
            <span className="eh-shell-orbit" aria-hidden="true"><i /></span>
            <span>equal horizons<span className="eh-shell-logo-stop">.</span></span>
          </Link>
          <nav className="eh-shell-nav" aria-label="Primary navigation">
            {navigation.map(({ href, label }) => (<Link key={href} href={href} aria-current={pathname === href ? 'page' : undefined}>
                {label}
              </Link>))}
          </nav>
          <div className="eh-shell-actions">
            <button type="button" className="eh-shell-search" onClick={() => setSearchOpen(true)} aria-label="Open search">
              <Search size={17} strokeWidth={1.8}/> <span>Search</span>
            </button>
            <Link className="eh-shell-account" href="/account">
              {user ? 'My account' : 'Sign in'} <ArrowUpRight size={15} strokeWidth={1.6}/>
            </Link>
            <button type="button" className="eh-shell-menu-button" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen ? <X size={22}/> : <Menu size={22}/>}
            </button>
          </div>
        </div>
        {menuOpen && (<nav className="eh-shell-mobile" aria-label="Mobile navigation">
            {navigation.map(({ href, label }) => <Link href={href} key={href} onClick={() => setMenuOpen(false)}>{label}<span>↗</span></Link>)}
            <Link href="/account" onClick={() => setMenuOpen(false)}>Your account <span>↗</span></Link>
          </nav>)}
      </header>
      {searchOpen && (<div className="eh-shell-search-overlay" role="presentation" onMouseDown={event => {
                if (event.target === event.currentTarget)
                    setSearchOpen(false);
            }}>
          <div className="eh-shell-search-dialog" role="dialog" aria-modal="true" aria-label="Search Equal Horizons">
            <div className="eh-shell-search-top"><span>Search Equal Horizons</span><button onClick={() => setSearchOpen(false)} aria-label="Close search"><X size={22}/></button></div>
            <form onSubmit={search}>
              <Search size={22} strokeWidth={1.6}/>
              <input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder="A place, a headline, a public document…" aria-label="Search terms"/>
              <button type="submit" aria-label="Submit search">↗</button>
            </form>
            <p>Search across reporting, civic documents, and the archive.</p>
          </div>
        </div>)}
    </>);
}
