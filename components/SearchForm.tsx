'use client';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Search } from './Icons';
export function SearchForm({ compact = false }: {
    compact?: boolean;
}) { const [q, setQ] = useState(''); const router = useRouter(); function go(e: FormEvent) { e.preventDefault(); router.push('/search?q=' + encodeURIComponent(q)); } return <form className={'search-form ' + (compact ? 'compact' : '')} onSubmit={go}><Search size={21} strokeWidth={1.9}/><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search a question, place, decision, or document..." aria-label="Search local stories and records"/><button type="submit" aria-label="Submit search"><ArrowRight size={23}/></button></form>; }
