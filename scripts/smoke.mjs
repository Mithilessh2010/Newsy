#!/usr/bin/env node
/** Run against a real deployed app. Usage: BASE_URL=https://your-deployment.example npm run smoke */
import assert from 'node:assert/strict';
const base=process.env.BASE_URL;
if(!base)throw new Error('BASE_URL is required. Do not test against a non-deployed application.');
const url=new URL(base);
if(!['https:','http:'].includes(url.protocol))throw Error('BASE_URL must be HTTP(S)');
const endpoints=[
 ['/', 'text/html'],['/news','text/html'],['/explore','text/html'],['/records','text/html'],
 ['/timelines','text/html'],['/account','text/html'],['/saved','text/html'],
 ['/search?q=transportation','text/html'],
 ['/api/locations/search?q=London','application/json'],
 ['/api/locations/detect','application/json'],
 ['/api/news?city=Tokyo&region=Tokyo&country=JP&scope=local','application/json'],
 ['/api/news?city=London&region=England&country=GB&scope=national','application/json'],
 ['/api/news?scope=world','application/json'],
 ['/api/search?q=transportation&city=Pleasanton&region=California&country=US','application/json']
];
let ok=0;
for(const [path,expected] of endpoints){
 const target=new URL(path,base);
 const ctrl=new AbortController();const timeout=setTimeout(()=>ctrl.abort(),25_000);
 try{
  const response=await fetch(target,{signal:ctrl.signal,redirect:'follow'});
  assert.equal(response.status,200,`${path} returned ${response.status}`);
  assert.ok((response.headers.get('content-type')||'').includes(expected),`${path} returned wrong content type`);
  const body=await response.text();assert.ok(body.length>10,`${path} returned an empty body`);
  if(path.startsWith('/api/news')){
   const result=JSON.parse(body);
   assert.ok(Array.isArray(result.stories),'news response must have a stories array');
   assert.ok(typeof result.available==='boolean','news response availability required');
   if(process.env.REQUIRE_LIVE_FEED==='1')assert.equal(result.available,true,`No news provider available for ${path}`);
  }
  console.log('PASS',path);ok++;
 }finally{clearTimeout(timeout)}
}
// Private endpoint must reject anonymous invocations, including if CRON_SECRET is unset.
const protectedResponse=await fetch(new URL('/api/cron/ingest',base));
assert.equal(protectedResponse.status,401,'Cron endpoint must not allow anonymous execution');
console.log('PASS cron authorization');ok++;
const status=await fetch(new URL('/api/health',base));
const health=await status.json();
assert.ok(['operational','degraded','not_configured'].includes(health.status));
if(process.env.REQUIRE_INGESTION==='1')assert.equal(health.status,'operational','Ingestion is not operational');
console.log('HEALTH',JSON.stringify(health));
console.log(`Smoke test passed: ${ok} endpoint checks. Feeds and ingestion only required if strict flags are set.`);
