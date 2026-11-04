import {FormEvent,useState} from 'react';
import {useAuth} from '../auth/useAuth';
type ResponseBody={ok:boolean;message?:string;data?:unknown};
export default function PlayerLookup({mode}:{mode:'alts'|'history'|'punishment'}){
 const {me,preview}=useAuth();const [username,setUsername]=useState(''),[result,setResult]=useState<ResponseBody|null>(null),[busy,setBusy]=useState(false);
 const endpoint=mode==='punishment'?'/api/punishments/check':mode==='history'?'/api/alts/history':'/api/alts';
 async function search(e:FormEvent){e.preventDefault();if(preview)return;setBusy(true);setResult(null);try{const r=await fetch(`${endpoint}?username=${encodeURIComponent(username.trim())}`,{credentials:'same-origin',cache:'no-store'});const body=await r.json() as ResponseBody;setResult(body)}catch{setResult({ok:false,message:'Unable to reach Staff Bot.'})}finally{setBusy(false)}}
 return <section className="page"><div className="title"><p>PLAYER MANAGEMENT</p><h1>{mode==='punishment'?'Check Punishment':mode==='history'?'Alts History':'Alts'}</h1></div><article className="access-card"><form className="punish-form" onSubmit={search}><label>Minecraft username<input required pattern="[A-Za-z0-9_]{3,16}" maxLength={16} value={username} onChange={e=>setUsername(e.target.value)} placeholder="Enter username"/></label><button className="access-primary" disabled={busy||!!preview}>{busy?'Checking…':'Check player'}</button></form>{result&&<div className={'access-notice '+(result.ok?'good':'bad')} role="status">{result.message}{result.data!==undefined&&<pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(result.data,null,2)}</pre>}</div>}</article></section>
}
