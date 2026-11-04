import {beforeEach,describe,it,expect,vi} from 'vitest';
import {seal} from '../worker/security/crypto';
import type {Env,SessionPayload} from '../worker/types';
const mocks=vi.hoisted(()=>({botAction:vi.fn()}));
vi.mock('../worker/bridge',()=>({botAction:mocks.botAction,pollBot:vi.fn(),submitBotResult:vi.fn(),StaffPanelBridge:class{}}));
import worker from '../worker/index';
const env={SESSION_SECRET:'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY='} as Env;
const actor='111111111111111111';
async function request(path:string,method='GET',body?:unknown,headers:Record<string,string>={}){
 const now=Date.now();const payload:SessionPayload={v:1,sub:actor,username:'staff',displayName:'Staff',avatar:null,csrf:'csrf',iat:now,exp:now+600000};
 const cookie=await seal(payload,env.SESSION_SECRET);
 const r=new Request('https://staff.jackpotmc.com'+path,{method,headers:{Cookie:'jmc_session='+cookie,Origin:'https://staff.jackpotmc.com','Content-Type':'application/json','X-CSRF-Token':'csrf',...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
 return {response:await worker.fetch(r,env),issued:now};
}
beforeEach(()=>{mocks.botAction.mockReset();mocks.botAction.mockResolvedValue({ok:true,data:{panelAccess:true,rank:'MANAGER',permissions:['panel.access']}})});
describe('bot authoritative panel access',()=>{
 it('fails closed when internal token is not configured',async()=>{const r=await worker.fetch(new Request('https://staff.jackpotmc.com/internal/bot/poll',{method:'POST',headers:{Authorization:'Bearer undefined'}}),env);expect(r.status).toBe(401)});
 it('requires authentication',async()=>{const r=await worker.fetch(new Request('https://staff.jackpotmc.com/api/access'),env);expect(r.status).toBe(401);expect(mocks.botAction).not.toHaveBeenCalled()});
 it('queries live status for current session',async()=>{const {response,issued}=await request('/api/me');expect(response.status).toBe(200);expect(mocks.botAction).toHaveBeenCalledWith(env,actor,'staff.status',{sessionIssuedAt:issued});expect((await response.json()).staff.rank).toBe('MANAGER')});
 it('denies a revoked or demoted user even with valid cookie',async()=>{mocks.botAction.mockResolvedValue({ok:false,code:'forbidden'});expect((await request('/api/me')).response.status).toBe(403)});
 it('does not accept missing explicit panelAccess',async()=>{mocks.botAction.mockResolvedValue({ok:true,data:{}});expect((await request('/api/me')).response.status).toBe(403)});
 it('overwrites browser identity and session timestamp',async()=>{const {response,issued}=await request('/api/access/overrides','POST',{discordId:'333333333333333333',actorDiscordId:'999999999999999999',sessionIssuedAt:9999999999999,mode:'FORCE_DENY',grant:[],deny:[],reason:'Regression test'});expect(response.status).toBe(200);expect(mocks.botAction.mock.calls[0][1]).toBe(actor);expect(mocks.botAction.mock.calls[0][3].sessionIssuedAt).toBe(issued)});
 it('rejects cross-origin mutation before dispatch',async()=>{expect((await request('/api/access/revoke','POST',{}, {Origin:'https://evil.example'})).response.status).toBe(403);expect(mocks.botAction).not.toHaveBeenCalled()});
 it('rejects incorrect csrf before dispatch',async()=>{expect((await request('/api/access/revoke','POST',{}, {'X-CSRF-Token':'wrong'})).response.status).toBe(403);expect(mocks.botAction).not.toHaveBeenCalled()});
 it('does not allow mutation with GET',async()=>{expect((await request('/api/access/roles')).response.status).toBe(405);expect(mocks.botAction).not.toHaveBeenCalled()});
 it('propagates authoritative action denial',async()=>{mocks.botAction.mockResolvedValue({ok:false,code:'forbidden'});expect((await request('/api/access/roles','POST',{})).response.status).toBe(403)});
});
