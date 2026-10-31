import type { Metadata } from 'next';
import { NewsPage } from '@/components/NewsPage';
export const metadata: Metadata = { title: 'The Local Wire · Latest News' };
export default function Page() { return <NewsPage />; }
