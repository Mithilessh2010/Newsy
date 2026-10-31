'use client';
import { useApp } from './Provider';
import { Bookmark, BookmarkCheck } from './Icons';
export function SaveButton({ id, large = false, item }: {
    id: string;
    large?: boolean;
    item?: {
        title: string;
        url: string;
        source: string;
        description?: string;
    };
}) { const { saved, toggleSaved } = useApp(); const on = saved.includes(id); return <button type="button" onClick={e => { e.preventDefault(); e.stopPropagation(); if (item) {
    try {
        const cache = JSON.parse(localStorage.getItem('eh-news-cache') || '{}');
        cache[id] = item;
        localStorage.setItem('eh-news-cache', JSON.stringify(cache));
    }
    catch { }
} toggleSaved(id, item); }} className={'save-button ' + (on ? 'is-saved ' : '') + (large ? 'large' : '')} aria-label={on ? 'Remove saved item' : 'Save item'} title={on ? 'Remove saved item' : 'Save for later'}>{on ? <BookmarkCheck size={large ? 20 : 18}/> : <Bookmark size={large ? 20 : 18}/>} {large && (on ? 'SAVED' : 'SAVE FOR LATER')}</button>; }
