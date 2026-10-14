import {NextResponse} from 'next/server';import {createClient} from '@supabase/supabase-js';
export const dynamic='force-dynamic';
/** Public operations status with no credentials or personal-location records exposed. */
export async function GET(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return NextResponse.json({status:'not_configured',database:false,ingestion:false},{status:503,headers:{'Cache-Control':'no-store'}});
 try{
  const sb=createClient(url,key,{auth:{persistSession:false}});
  const {data,error}=await sb.from('monitored_feeds').select('last_checked_at,last_status').eq('feed_key','world').maybeSingle();
  if(error)return NextResponse.json({status:'degraded',database:false,ingestion:false},{status:503,headers:{'Cache-Control':'no-store'}});
  const timestamp=data?.last_checked_at||null;
  const age=timestamp?Date.now()-Date.parse(timestamp):Infinity;
  const running=data?.last_status==='ok'&&age>=0&&age<45*60_000;
  return NextResponse.json({status:running?'operational':'degraded',database:true,ingestion:running,lastWorldPollAt:timestamp,refreshTargetMinutes:15},
    {status:running?200:503,headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({status:'degraded',database:false,ingestion:false},{status:503,headers:{'Cache-Control':'no-store'}})}
}
