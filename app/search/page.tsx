import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SearchResults } from '@/components/SearchResults';
export const metadata: Metadata = { title: 'Search the Local Record' };
export default function Page() { return <Suspense fallback={<div className="page-content page-top">Searching local records...</div>}><SearchResults /></Suspense>; }
