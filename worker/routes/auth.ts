import type { DiscordUser, Env, SessionPayload } from '../types';
import { clearSession, clearState, cookies, sessionCookie, stateCookie } from '../security/cookies';
import { isAllowed } from '../security/auth';
import { botAction } from '../bridge';
import { randomToken, seal, unseal } from '../security/crypto';
const DISCORD_REDIRECT_URI='https://staff.jackpotmc.com/auth/callback';
export async function login(_request:Request,env:Env){ const state=randomToken(); const stateValue=await seal({state,exp:Date.now()+600_000},env.SESSION_SECRET); const q=new URLSearchParams({client_id:env.DISCORD_CLIENT_ID,response_type:'code',redirect_uri:DISCORD_REDIRECT_URI,scope:'identify',state,prompt:'consent'}); return new Response(null,{status:302,headers:{Location:`https://discord.com/oauth2/authorize?${q}`, 'Set-Cookie':stateCookie(stateValue)}}); }
export async function callback(request:Request,env:Env){ const url=new URL(request.url); const code=url.searchParams.get('code'), got=url.searchParams.get('state'); const stored=cookies(request).jmc_oauth_state; const parsed=stored?await unseal<{state:string;exp:number}>(stored,env.SESSION_SECRET):null; if(!code||!got||!parsed||parsed.exp<Date.now()||parsed.state!==got) return new Response('Invalid or expired OAuth state.',{status:400,headers:{'Set-Cookie':clearState()}});
 const body=new URLSearchParams({client_id:env.DISCORD_CLIENT_ID,client_secret:env.DISCORD_CLIENT_SECRET,grant_type:'authorization_code',code,redirect_uri:DISCORD_REDIRECT_URI});
 const tr=await fetch('https://discord.com/api/v10/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body}); if(!tr.ok)return new Response('Discord token exchange failed.',{status:502}); const token=await tr.json() as {access_token:string;token_type:string};
 const ur=await fetch('https://discord.com/api/v10/users/@me',{headers:{Authorization:`Bearer ${token.access_token}`}}); if(!ur.ok)return new Response('Discord identity lookup failed.',{status:502}); const user=await ur.json() as DiscordUser;
 if(!isAllowed(env,user.id)) return new Response(null,{status:302,headers:{Location:'/denied','Set-Cookie':clearState()}});
 const authz=await botAction(env,user.id,'staff.status',{}); if(!authz.ok) return new Response(null,{status:302,headers:{Location:'/denied','Set-Cookie':clearState()}});
 const now=Date.now(); const payload:SessionPayload={v:1,sub:user.id,username:user.username,displayName:user.global_name||user.username,avatar:user.avatar||null,csrf:randomToken(),iat:now,exp:now+7_200_000}; const tokenCookie=await seal(payload,env.SESSION_SECRET); const headers=new Headers({Location:'/'}); headers.append('Set-Cookie',clearState()); headers.append('Set-Cookie',sessionCookie(tokenCookie)); return new Response(null,{status:302,headers}); }
export function logout(){ return new Response(null,{status:302,headers:{Location:'/login','Set-Cookie':clearSession()}}); }
