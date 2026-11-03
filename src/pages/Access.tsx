import {FormEvent,useState} from 'react';
import {useAuth} from '../auth/useAuth';
const operations=[['roles','roles.manage','Map Discord role'],['ranks','permissions.manage','Rank permissions'],['overrides','overrides.manage','User override'],['revoke','sessions.manage','Revoke sessions']] as const;
export default function Access(){
 const {me}=useAuth();const permissions=me?.staff.permissions||[];
 const available=operations.filter(([,p])=>permissions.includes(p));
 const [op,setOp]=useState<string>(available[0]?.[0]||''),[id,setId]=useState(''),[rank,setRank]=useState('MANAGER'),[level,setLevel]=useState('50'),[mode,setMode]=useState('NONE'),[grant,setGrant]=useState(''),[deny,setDeny]=useState(''),[reason,setReason]=useState(''),[result,setResult]=useState<unknown>(null),[busy,setBusy]=useState(false);
 const list=(s:string)=>s.split(',').map(x=>x.trim()).filter(Boolean);
 async function read(path:string){setBusy(true);try{const r=await fetch(path);setResult(await r.json())}catch{setResult({error:'Bot unavailable'})}finally{setBusy(false)}}
 async function submit(e:FormEvent){e.preventDefault();if(!me||busy)return;setBusy(true);try{
   const body=op==='roles'?{roleId:id,rank,reason}:op==='ranks'?{rank,level:Number(level),permissions:list(grant),reason}:op==='overrides'?{discordId:id,mode,grant:list(grant),deny:list(deny),reason}:{discordId:id,reason};
   const r=await fetch('/api/access/'+op,{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':me.csrf},body:JSON.stringify(body)});setResult(await r.json());
 }catch{setResult({error:'Request failed; reload configuration before retrying'})}finally{setBusy(false)}}
 return <section className="page"><h1>Access management</h1><p>Changes take effect on the next request. Every change requires a reason and is audited. Manager is the normal minimum; FORCE_ALLOW is an explicit exception. Emergency identity is configured on the bot host.</p>
 {permissions.includes('access.read')&&<button disabled={busy} onClick={()=>read('/api/access')}>Load configuration</button>} {permissions.includes('audit.read')&&<button disabled={busy} onClick={()=>read('/api/audit')}>View latest audit records</button>}
 {available.length>0&&<form onSubmit={submit}><label>Operation<select value={op} onChange={e=>setOp(e.target.value)}>{available.map(([v,,title])=><option key={v} value={v}>{title}</option>)}</select></label>
 {op!=='ranks'&&<label>{op==='roles'?'Discord role ID':'Discord user ID'}<input required value={id} onChange={e=>setId(e.target.value)} pattern="[0-9]{15,22}"/></label>}
 {(op==='roles'||op==='ranks')&&<label>Rank<select value={rank} onChange={e=>setRank(e.target.value)}>{['MODERATOR','SRMOD','ADMIN','SRADMIN','MANAGER','OWNER',...(op==='roles'?['NONE']:[])].map(x=><option key={x}>{x}</option>)}</select></label>}
 {op==='ranks'&&<label>Hierarchy level (Manager = 50)<input required type="number" value={level} onChange={e=>setLevel(e.target.value)}/></label>}
 {op==='overrides'&&<label>Access override<select value={mode} onChange={e=>setMode(e.target.value)}>{['NONE','FORCE_ALLOW','FORCE_DENY'].map(x=><option key={x}>{x}</option>)}</select></label>}
 {(op==='ranks'||op==='overrides')&&<label>Granted permissions (comma separated, no wildcards)<input value={grant} onChange={e=>setGrant(e.target.value)}/></label>}
 {op==='overrides'&&<label>Denied permissions (take precedence)<input value={deny} onChange={e=>setDeny(e.target.value)}/></label>}
 <label>Reason<input required minLength={5} maxLength={500} value={reason} onChange={e=>setReason(e.target.value)}/></label><button disabled={busy}>Save audited change</button></form>}
 {result!==null&&<pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(result,null,2)}</pre>}</section>
}
