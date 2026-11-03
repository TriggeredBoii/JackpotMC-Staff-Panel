import type { Env, SessionPayload } from '../types';
import { cookies } from './cookies';
import { unseal } from './crypto';
export async function session(request:Request,env:Env){ const token=cookies(request).jmc_session; if(!token)return null; const s=await unseal<SessionPayload>(token,env.SESSION_SECRET); if(!s||s.v!==1||s.exp<=Date.now())return null; return s; }
export async function requireSession(request:Request,env:Env){ const s=await session(request,env); return s ? {ok:true as const,session:s} : {ok:false as const,response:Response.json({error:'unauthorized'},{status:401})}; }
export function requireCsrf(request:Request,s:SessionPayload){ if(!['POST','PUT','PATCH','DELETE'].includes(request.method))return true; return request.headers.get('X-CSRF-Token')===s.csrf; }
