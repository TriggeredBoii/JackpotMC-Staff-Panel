import type { Env } from './types';
import { callback, login, logout } from './routes/auth';
import { requireSession, session } from './security/auth';
import { harden } from './security/headers';
import { botAction, pollBot, StaffPanelBridge, submitBotResult } from './bridge';

const WRITE_METHODS = new Set(['POST','PUT','PATCH','DELETE']);

async function jsonBody(request: Request, maxBytes = 16_384) {
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) throw new Error('JSON body required');
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) throw new Error('Request body too large');
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
  if(!env.STAFF_PANEL_BOT_TOKEN||request.headers.get('Authorization')!==`Bearer ${env.STAFF_PANEL_BOT_TOKEN}`){
    return Response.json({error:'unauthorized'},{status:401});
  }
  return pollBot(env);
}

if(url.pathname==='/internal/bot/result'&&request.method==='POST'){
  if(!env.STAFF_PANEL_BOT_TOKEN||request.headers.get('Authorization')!==`Bearer ${env.STAFF_PANEL_BOT_TOKEN}`){
    return Response.json({error:'unauthorized'},{status:401});
  }
  const body=await jsonBody(request,8_388_608);
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
 if(url.pathname==='/auth/logout') return logout();
 if(url.pathname==='/api/health') return Response.json({status:'ok',service:'jackpotmc-staff-panel',environment:'production',protocol:2});
 if(url.pathname==='/api/me'){
   const s=await session(request,env); if(!s)return Response.json({authenticated:false},{status:401});
   const result=await botAction(env,s.sub,'staff.status',{sessionIssuedAt:s.iat});
   const staff=result.data as {panelAccess?:boolean}|undefined;
   if(!result.ok||staff?.panelAccess!==true)return Response.json({authenticated:false},{status:403});
   return Response.json({authenticated:true,user:{id:s.sub,username:s.username,displayName:s.displayName,avatar:s.avatar},csrf:s.csrf,staff});
 }
 if(url.pathname.startsWith('/api/')){
   const a=await requireSession(request,env); if(!a.ok)return a.response;
   const rejected=securityCheck(request,url,a.session.csrf); if(rejected)return rejected;
   const management:Record<string,string>={
     '/api/access':'access.read','/api/audit':'audit.read',
     '/api/access/roles':'roles.set','/api/access/ranks':'ranks.set',
     '/api/access/overrides':'overrides.set','/api/access/revoke':'sessions.revoke'
   };
   const managementAction=management[url.pathname];
   if(managementAction){
     const read=managementAction.endsWith('.read');
     if(request.method!==(read?'GET':'POST'))return Response.json({error:'method_not_allowed'},{status:405});
     const body=read?{}:await jsonBody(request);
     const result=await botAction(env,a.session.sub,managementAction,{...body,sessionIssuedAt:a.session.iat});
     return Response.json(result,{status:result.ok?200:403});
   }
   if(url.pathname==='/api/bot/status'&&request.method==='GET'){
     const result=await botAction(env,a.session.sub,'staff.status',{sessionIssuedAt:a.session.iat}); return Response.json(result,{status:result.ok?200:403});
   }
   if(url.pathname==='/api/punishments/types'&&request.method==='GET'){
     const result=await botAction(env,a.session.sub,'punishment.types',{sessionIssuedAt:a.session.iat}); return Response.json(result,{status:result.ok?200:403});
   }
   if(url.pathname==='/api/punishments/categories'&&request.method==='GET'){
     const result=await botAction(env,a.session.sub,'punishment.categories',{sessionIssuedAt:a.session.iat}); return Response.json(result,{status:result.ok?200:403});
   }
   if(url.pathname==='/api/punishments/execute'&&request.method==='POST'){
     const body=await jsonBody(request); const result=await botAction(env,a.session.sub,'punishment.execute',{username:body.username,type:body.type,sessionIssuedAt:a.session.iat}); return Response.json(result,{status:result.ok?200:400});
   }
   if(url.pathname==='/api/punishments/history'&&request.method==='GET'){
     const username=url.searchParams.get('username')||'';
     const offset=Number(url.searchParams.get('offset')||0);
     if(!/^[A-Za-z0-9_]{3,16}$/.test(username)||!Number.isInteger(offset)||offset<0||offset>100000)
       return Response.json({ok:false,message:'Invalid history request.'},{status:400});
     const result=await botAction(env,a.session.sub,'punishment.history',{username,offset,sessionIssuedAt:a.session.iat});
     return Response.json(result,{status:result.ok?200:403});
   }
   if(url.pathname==='/api/punishments/unpunish'&&request.method==='POST'){
     const body=await jsonBody(request);
     if(typeof body.username!=='string'||typeof body.type!=='string')return Response.json({ok:false,message:'Invalid request.'},{status:400});
     const result=await botAction(env,a.session.sub,'punishment.unpunish',{username:body.username,type:body.type,sessionIssuedAt:a.session.iat});
     return Response.json(result,{status:result.ok?200:400});
   }
   return Response.json({error:'not_found'},{status:404});
 }
// Public pages and static frontend assets
if (
   url.pathname === '/login' ||
   url.pathname === '/denied' ||
   url.pathname === '/favicon.ico' ||
   url.pathname.startsWith('/assets/')
 ) {
   return env.ASSETS.fetch(request);
 }
 
 // All other frontend pages require authentication
 const s = await session(request, env);
 
 if (!s) {
   return Response.redirect(`${url.origin}/login`, 302);
 }
 
 return env.ASSETS.fetch(request);
}
export default { async fetch(request:Request,env:Env){ try{return harden(await app(request,env));}catch(e){console.error(e instanceof Error?e.message:'internal error');return harden(Response.json({error:'internal_server_error'},{status:500}));} } };

export { StaffPanelBridge };
