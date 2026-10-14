import {createHash} from 'node:crypto';
import type {CommunityLocation,NewsScope} from './location';
import type {FeedItem} from './news';

/** One identity for a headline across the live feed, archives, saves, and story URLs. */
export function feedLocationKey(location:CommunityLocation,scope:NewsScope):string{
 return scope==='world'?'world':scope==='national'?location.countryCode:location.id;
}
export function storyId(url:string,location:CommunityLocation,scope:NewsScope):string{
 return 'n-'+createHash('sha256').update([feedLocationKey(location,scope),scope,url].join('|')).digest('hex').slice(0,32);
}
export function archiveRows(stories:FeedItem[],location:CommunityLocation,scope:NewsScope,now:string){
 return stories.filter(s=>s.url.startsWith('https://')||s.url.startsWith('http://')).map(s=>({
  id:storyId(s.url,location,scope),title:s.title.slice(0,1000),publisher:s.source.slice(0,240),
  url:s.url,published_at:s.publishedAt,category:s.category,city:scope==='world'?'Worldwide':location.name,
  country_code:scope==='world'?'ZZ':location.countryCode,region:scope==='world'?'':location.region,
  location_key:feedLocationKey(location,scope),scope,last_seen_at:now
 }));
}
export function mergeStories<T extends {url:string,publishedAt:string}>(live:T[],archive:T[],limit=100){
 const seen=new Set<string>();return [...live,...archive].sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt))
 .filter(s=>{const key=s.url.trim().toLowerCase();if(seen.has(key))return false;seen.add(key);return true}).slice(0,limit);
}
