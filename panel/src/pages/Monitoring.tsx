import {useCallback,useEffect,useState,type FormEvent} from 'react';
import {useAuth} from '../auth/useAuth';

type Account={uuid:string;username?:string;channelId?:string;channelName?:string;lastMessageId?:string;linkedDiscordId?:string};
type Event={id:string;author:string;timestamp:number;content:string;url:string};
type Reply<T>={ok:boolean;message?:string;data?:T};
const readKey=(uuid:string)=>`jackpotmc-monitoring-read:${uuid}`;
export default function Monitoring(){
 const {me,preview}=useAuth();
 const [accounts,setAccounts]=useState<Account[]>([]),[selected,setSelected]=useState<Account|null>(null),[events,setEvents]=useState<Event[]>([]);
 const [username,setUsername]=useState(''),[channelId,setChannelId]=useState(''),[operation,setOperation]=useState('add');
 const [notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[loadingHistory,setLoadingHistory]=useState(false),[read,setRead]=useState<Record<string,string>>({});
 const canView=!!me?.staff.permissions.includes('monitoring.view');
 const canHistory=!!me?.staff.permissions.includes('monitoring.history.view');
 const canManage=!!me?.staff.permissions.includes('monitoring.manage');
 const load=useCallback(async()=>{
  try{const r=await fetch('/api/monitoring');const data=await r.json() as Reply<{accounts:Account[]}>;
   if(!r.ok||!data.ok)throw new Error(data.message||'Monitoring unavailable');
   setAccounts(data.data?.accounts||[]);
  }catch(e){setNotice(String(e))}
 },[]);
 useEffect(()=>{if(canView)void load()},[canView,load]);
 const open=async(account:Account)=>{
  setSelected(account);setEvents([]);setLoadingHistory(true);setNotice('');
  try{const r=await fetch(`/api/monitoring/history?uuid=${encodeURIComponent(account.uuid)}`);
   const data=await r.json() as Reply<{events:Event[]}>;
   if(!r.ok||!data.ok)throw new Error(data.message||'History unavailable');
   setEvents(data.data?.events||[]);
   if(account.lastMessageId){localStorage.setItem(readKey(account.uuid),account.lastMessageId);setRead(old=>({...old,[account.uuid]:account.lastMessageId!}));}
  }catch(e){setNotice(String(e))}finally{setLoadingHistory(false)}
 };
 const unread=(a:Account)=>!!a.lastMessageId&&a.lastMessageId!==(read[a.uuid]??localStorage.getItem(readKey(a.uuid)));
 const newCount=accounts.filter(unread).length;
 async function submit(e:FormEvent){e.preventDefault();if(!me||!canManage||preview)return;
  if(!window.confirm(`${operation} monitoring for ${username}?`))return;
  setBusy(true);setNotice('');
  try{const r=await fetch('/api/monitoring',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':me.csrf},body:JSON.stringify({username,operation,channelId})});
   const data=await r.json() as Reply<unknown>;
   if(!r.ok||!data.ok)throw new Error(data.message||'Operation failed');
   setNotice(data.message||'Monitoring updated');setUsername('');if(operation==='remove')setSelected(null);await load();
  }catch(e){setNotice(`${String(e)}. Check the bot logs before retrying.`)}finally{setBusy(false)}
 }
 if(!canView)return <section className="page"><h1>Monitoring</h1><p>You do not have monitoring access.</p></section>;
 return <section className="page">
  <div className="title"><p>STAFF / SECURITY</p><h1>Monitoring</h1><span>Channel activity is checked without copying Discord messages into MongoDB.</span></div>
  <div className="access-card"><h2>Monitoring dashboard</h2><p><strong>{accounts.length}</strong> monitored accounts · <strong>{newCount}</strong> channels with activity since last opened on this browser</p>
   <button className="access-secondary" onClick={()=>void load()} disabled={busy}>Refresh activity</button>
   <div className="mapping-list">{accounts.map(a=><button key={a.uuid} className="mapping-row" style={{width:'100%',textAlign:'left',cursor:'pointer'}} disabled={!canHistory} onClick={()=>void open(a)}>
    <strong>{a.username||a.uuid}</strong><span>{a.channelName?`#${a.channelName}`:a.channelId||'Channel unavailable'}</span>
    <span>{unread(a)?'New activity':'Viewed'}</span>
   </button>)}{accounts.length===0&&<p>No monitored accounts.</p>}</div>
  </div>
  {selected&&canHistory&&<article className="access-card"><h2>{selected.username||selected.uuid} · Channel history</h2>
   <p>{selected.channelName?`#${selected.channelName}`:selected.channelId} · Latest 25 messages</p>
   <button className="access-secondary" disabled={loadingHistory} onClick={()=>void open(selected)}>Refresh messages</button>
   {loadingHistory?<p>Loading messages…</p>:<div className="audit-list">{events.map(ev=><div key={ev.id} className="audit-entry" style={{padding:12,whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>
    <strong>{ev.author}</strong> <time>{new Date(ev.timestamp).toLocaleString()}</time>
    <p>{ev.content||'(No text content)'}</p><a href={ev.url} target="_blank" rel="noreferrer">View in Discord</a>
   </div>)}{events.length===0&&<p>No messages found.</p>}</div>}
  </article>}
  {canManage&&<article className="access-card"><h2>Monitoring administration</h2><p>Add staff to an existing Discord monitoring channel or remove monitoring using the same removal notification as the bot command.</p>
   <form className="punish-form" onSubmit={submit}>
    <label>Minecraft username<input required pattern="[A-Za-z0-9_]{3,16}" value={username} onChange={e=>setUsername(e.target.value)}/></label>
    <label>Action<select value={operation} onChange={e=>setOperation(e.target.value)}><option value="add">Add</option><option value="remove">Remove</option></select></label>
    {operation==='add'&&<label>Existing Discord channel ID<input required pattern="[0-9]{15,22}" value={channelId} onChange={e=>setChannelId(e.target.value)}/></label>}
    <button className="access-primary" disabled={busy||!!preview}>{busy?'Working…':'Apply'}</button>
   </form>
  </article>}
  {notice&&<div role="status" className="access-notice">{notice}</div>}
 </section>;
}
