import type { Env } from './types';
import { callback, login, logout } from './routes/auth';
import { requireCsrf, requireSession, session } from './security/auth';
import { harden } from './security/headers';
import { botAction, pollBot, StaffPanelBridge, submitBotResult } from './bridge';

const WRITE_METHODS = new Set(['POST','PUT','PATCH','DELETE']);

async function jsonBody(request: Request) {
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) throw new Error('JSON body required');
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > 16_384) throw new Error('Request body too large');
  return JSON.parse(text) as Record<string, unknown>;
}

function securityCheck(request: Request, url: URL, csrf: string): Response | null {
  if (!WRITE_METHODS.has(request.method)) return null;
  if (request.headers.get('Origin') !== url.origin) return Response.json({error:'invalid_origin'},{status:403});
  const fetchSite = request.headers.get('Sec-Fetch-Site');
  if (fetchSite && fetchSite !== 'same-origin') return Response.json({error:'invalid_fetch_site'},{status:403});
  if (request.headers.get('X-CSRF-Token') !== csrf) return Response.json({error:'invalid_csrf'},{status:403});
  return null;
}

async function app(request:Request,env:Env):Promise<Response>{
 const url=new URL(request.url);
if(url.pathname==='/internal/bot/poll'&&request.method==='POST'){
  if(request.headers.get('Authorization')!==`Bearer ${env.STAFF_PANEL_BOT_TOKEN}`){
    return Response.json({error:'unauthorized'},{status:401});
  }
  return pollBot(env);
}

if(url.pathname==='/internal/bot/result'&&request.method==='POST'){
  if(request.headers.get('Authorization')!==`Bearer ${env.STAFF_PANEL_BOT_TOKEN}`){
    return Response.json({error:'unauthorized'},{status:401});
  }
  const body=await jsonBody(request);
  const actionId=typeof body.actionId==='string'?body.actionId:'';
  const result=body.result;
  if(
    !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(actionId)
    || !result || typeof result !== 'object' || Array.isArray(result)
  ) return Response.json({error:'invalid_request'},{status:400});
  return submitBotResult(env,actionId,result as Record<string,unknown>);
}
 if(url.pathname==='/auth/login') return login(request,env);
 if(url.pathname==='/auth/callback') return callback(request,env);
 if(url.pathname==='/auth/logout') return logout(request);
 if(url.pathname==='/api/health') return Response.json({status:'ok',service:'jackpotmc-staff-panel',environment:'production',protocol:2});
 if(url.pathname==='/api/me'){ const s=await session(request,env); return s?Response.json({authenticated:true,user:{id:s.sub,username:s.username,displayName:s.displayName,avatar:s.avatar},csrf:s.csrf}):Response.json({authenticated:false},{status:401}); }
 if(url.pathname.startsWith('/api/')){
   const a=await requireSession(request,env); if(!a.ok)return a.response;
   const rejected=securityCheck(request,url,a.session.csrf); if(rejected)return rejected;
   if(url.pathname==='/api/bot/status'&&request.method==='GET'){
     const result=await botAction(env,a.session.sub,'staff.status',{}); return Response.json(result,{status:result.ok?200:403});
   }
   if(url.pathname==='/api/punishments/types'&&request.method==='GET'){
     const result=await botAction(env,a.session.sub,'punishment.types',{}); return Response.json(result,{status:result.ok?200:403});
   }
   if(url.pathname==='/api/punishments/execute'&&request.method==='POST'){
     const body=await jsonBody(request); const result=await botAction(env,a.session.sub,'punishment.execute',{username:body.username,type:body.type}); return Response.json(result,{status:result.ok?200:400});
   }
   return Response.json({error:'not_found'},{status:404});
 }
 if(url.pathname==='/login'||url.pathname==='/denied') return env.ASSETS.fetch(request);
 const s=await session(request,env); if(!s) return Response.redirect(`${url.origin}/login`,302);
 return env.ASSETS.fetch(request);
}
export default { async fetch(request:Request,env:Env){ try{return harden(await app(request,env));}catch(e){console.error(e instanceof Error?e.message:'internal error');return harden(Response.json({error:'internal_server_error'},{status:500}));} } };

export { StaffPanelBridge };
