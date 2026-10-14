'use client';
import {createContext,useContext,useEffect,useMemo,useState,type ReactNode} from 'react';
import type {User} from '@supabase/supabase-js';
import {cities} from '@/lib/content';import {supabase} from '@/lib/supabase';
import {DEFAULT_LOCATION,FEATURED_LOCATIONS,normalizeLocation,type CommunityLocation,type NewsScope} from '@/lib/location';
export type SaveMetadata={title:string;url:string;source:string;description?:string};
type State={city:string;setCity:(name:string)=>void;location:CommunityLocation;setLocation:(loc:CommunityLocation)=>void;scope:NewsScope;setScope:(scope:NewsScope)=>void;saved:string[];toggleSaved:(id:string,item?:SaveMetadata)=>void;following:string[];toggleFollow:(id:string)=>void;user:User|null;ready:boolean;login:(email:string)=>Promise<string>;logout:()=>Promise<void>;authConfigured:boolean};
const ctx=createContext<State|null>(null);
function read(key:string):string[]{try{const v=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(v)?v.filter(x=>typeof x==='string'):[]}catch{return []}}
export function Provider({children}:{children:ReactNode}){
 const[location,setCurrentLocation]=useState<CommunityLocation>(DEFAULT_LOCATION),[scope,setCurrentScope]=useState<NewsScope>('local');
 const[saved,setSaved]=useState<string[]>([]),[following,setFollowing]=useState<string[]>([]),[user,setUser]=useState<User|null>(null),[ready,setReady]=useState(false);const sb=supabase();
 useEffect(()=>{const savedLocation=localStorage.getItem('eh-location');let restored:CommunityLocation|null=null;try{restored=savedLocation?normalizeLocation(JSON.parse(savedLocation)):null}catch{}if(!restored){const old=localStorage.getItem('eh-city');if(cities.includes(old||''))restored=FEATURED_LOCATIONS.find(l=>l.name===old)||DEFAULT_LOCATION;}if(restored)setCurrentLocation(restored);
 else fetch('/api/locations/detect').then(r=>r.json()).then(result=>{const guessed=normalizeLocation(result.location);if(guessed&&!localStorage.getItem('eh-location'))setCurrentLocation(guessed)}).catch(()=>{});
 const savedScope=localStorage.getItem('eh-news-scope');if(savedScope==='local'||savedScope==='national'||savedScope==='world')setCurrentScope(savedScope);
 setSaved(read('eh-saved'));setFollowing(read('eh-following'));
 const client=supabase();if(!client){setReady(true);return;}client.auth.getUser().then(({data})=>setUser(data.user)).catch(()=>setUser(null)).finally(()=>setReady(true));const {data:{subscription}}=client.auth.onAuthStateChange((_event,session)=>setUser(session?.user||null));return()=>subscription.unsubscribe()},[]);
 useEffect(()=>{if(!user||!sb)return;let active=true;Promise.all([sb.from('saved_items').select('item_id,metadata').eq('user_id',user.id),sb.from('followed_topics').select('topic_id').eq('user_id',user.id)]).then(([a,b])=>{if(!active)return;if(!a.error){setSaved(old=>[...new Set([...old,...(a.data||[]).map(x=>x.item_id)])]);try{const previous=JSON.parse(localStorage.getItem('eh-news-cache')||'{}');for(const row of a.data||[]){const v=row.metadata;if(v&&typeof v==='object'&&typeof v.title==='string'&&typeof v.url==='string'&&(v.url.startsWith('https://')||v.url.startsWith('http://'))){previous[row.item_id]={title:v.title,url:v.url,source:typeof v.source==='string'?v.source:'Original publisher',description:typeof v.description==='string'?v.description:''};}}localStorage.setItem('eh-news-cache',JSON.stringify(previous));window.dispatchEvent(new Event('eh-bookmarks-sync'));}catch{}}if(!b.error)setFollowing(old=>[...new Set([...old,...(b.data||[]).map(x=>x.topic_id)])]);}).catch(()=>{});return()=>{active=false}},[user?.id]);

 useEffect(()=>{if(!user||!sb)return;void sb.from('followed_locations').upsert({user_id:user.id,location_key:location.id,city:location.name,region:location.region,country_code:location.countryCode},{onConflict:'user_id,location_key'});},[user?.id,location.id]);
 function setLocation(next:CommunityLocation){const clean=normalizeLocation(next);if(!clean)return;setCurrentLocation(clean);localStorage.setItem('eh-location',JSON.stringify(clean));localStorage.setItem('eh-city',clean.name);
 // Each signed-in user's selected city is eligible for background archival ingestion.
 if(sb&&user)void sb.from('followed_locations').upsert({user_id:user.id,location_key:clean.id,city:clean.name,region:clean.region,country_code:clean.countryCode},{onConflict:'user_id,location_key'});
 }
 const setCity=(name:string)=>{const found=FEATURED_LOCATIONS.find(c=>c.name===name);if(found)setLocation(found)};
 const setScope=(value:NewsScope)=>{setCurrentScope(value);localStorage.setItem('eh-news-scope',value)};
 const toggleSaved=(id:string,item?:SaveMetadata)=>{const on=saved.includes(id),next=on?saved.filter(x=>x!==id):[...saved,id];setSaved(next);localStorage.setItem('eh-saved',JSON.stringify(next));if(user&&sb){if(on)void sb.from('saved_items').delete().eq('user_id',user.id).eq('item_id',id);else void sb.from('saved_items').upsert({user_id:user.id,item_id:id,...(item?{metadata:item}:{})})}};
 const toggleFollow=(id:string)=>{const on=following.includes(id),next=on?following.filter(x=>x!==id):[...following,id];setFollowing(next);localStorage.setItem('eh-following',JSON.stringify(next));if(user&&sb){if(on)void sb.from('followed_topics').delete().eq('user_id',user.id).eq('topic_id',id);else void sb.from('followed_topics').upsert({user_id:user.id,topic_id:id})}};
 const login=async(email:string)=>{if(!sb)return 'Connect Supabase to enable accounts.';const {error}=await sb.auth.signInWithOtp({email,options:{emailRedirectTo:window.location.origin+'/account'}});return error?error.message:'Check your email for your secure sign-in link.'};
 const logout=async()=>{await sb?.auth.signOut();setUser(null);setSaved([]);setFollowing([]);localStorage.removeItem('eh-saved');localStorage.removeItem('eh-following');localStorage.removeItem('eh-news-cache')};
 const value=useMemo(()=>({city:location.name,setCity,location,setLocation,scope,setScope,saved,toggleSaved,following,toggleFollow,user,ready,login,logout,authConfigured:!!sb}),[location,scope,saved,following,user,ready,sb]);return <ctx.Provider value={value}>{children}</ctx.Provider>;
}
export function useApp(){const v=useContext(ctx);if(!v)throw new Error('Provider required');return v}
