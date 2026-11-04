import {FormEvent,useState} from 'react';
import {Gavel,History,Undo2,Search,ChevronLeft,ChevronRight} from 'lucide-react';
import {useAuth} from '../auth/useAuth';
import PlayerLookup from './PlayerLookup';
import {usePunishmentCatalog} from '../data/punishmentCatalog';
type Result={ok:boolean;code?:string;message:string;data?:unknown};
type HistoryEntry={timestamp:number;description:string};
type HistoryData={username:string;total:number;nextOffset:number;entries:HistoryEntry[]};
const valid=(name:string)=>/^[A-Za-z0-9_]{3,16}$/.test(name.trim());
function clean(text:string){return text.replace(/&[0-9a-fk-or]/gi,'').replace(/§[0-9a-fk-or]/gi,'');}
export default function Punishments(){
 const {me}=useAuth();const canExecute=me?.staff.permissions.includes('punishment.execute')===true;
 const [tab,setTab]=useState<'punish'|'unpunish'|'history'|'check'>('punish');
 const [category,setCategory]=useState<'mute'|'ban'>('mute');
 const {types,categories,loaded:categoriesLoaded,error:catalogError}=usePunishmentCatalog(Boolean(me));
 const [username,setUsername]=useState(''),[type,setType]=useState('');
 const [result,setResult]=useState<Result|null>(null),[busy,setBusy]=useState(false);
 const [history,setHistory]=useState<HistoryData|null>(null),[offset,setOffset]=useState(0),[filter,setFilter]=useState('');
 async function loadHistory(next=0){if(!valid(username))return;setBusy(true);setResult(null);try{const r=await fetch(`/api/punishments/history?username=${encodeURIComponent(username.trim())}&offset=${next}`);const body:Result=await r.json();if(!body.ok)throw new Error(body.message);setHistory(body.data as HistoryData);setOffset(next)}catch(e){setResult({ok:false,message:e instanceof Error?e.message:'History request failed.'})}finally{setBusy(false)}}
 async function submit(e:FormEvent){e.preventDefault();if(!me||!canExecute||!valid(username)||!selectedType)return;const action=tab;if(action==='history'||!categoriesLoaded||categories[selectedType]!==category)return;if(!window.confirm(`${action==='punish'?'Punish':'Unpunish'} ${username.trim()} for ${selectedType.replaceAll('_',' ')}? This changes live player records.`))return;setBusy(true);setResult(null);try{const path=action==='punish'?'execute':'unpunish';const r=await fetch(`/api/punishments/${path}`,{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':me.csrf},body:JSON.stringify({username:username.trim(),type:selectedType})});const body:Result=await r.json();setResult(body);if(body.ok)setHistory(null)}catch{setResult({ok:false,message:'Request failed. Check the bot logs before retrying to avoid duplicate actions.'})}finally{setBusy(false)}}
 const filtered=history?.entries.filter(x=>clean(x.description).toLowerCase().includes(filter.toLowerCase()))||[];
 const selectedCategory=category;
 const matchingTypes=types.filter(t=>categories[t]===selectedCategory);
 const selectedType=matchingTypes.includes(type)?type:(matchingTypes[0]||'');
 return <section className="page punish-page"><div className="title"><p>PLAYER MANAGEMENT</p><h1>Punishments</h1></div>
 <div className="punish-tabs"><button className={tab==='punish'?'selected':''} onClick={()=>{setTab('punish');setResult(null)}}><Gavel size={17}/> Punish</button><button className={tab==='unpunish'?'selected':''} onClick={()=>{setTab('unpunish');setResult(null)}}><Undo2 size={17}/> Unpunish</button><button className={tab==='history'?'selected':''} onClick={()=>{setTab('history');setResult(null)}}><History size={17}/> History</button><button className={tab==='check'?'selected':''} onClick={()=>{setTab('check');setResult(null)}}><Search size={17}/> Check Punishment</button></div>
 {tab==='check'?<PlayerLookup mode="punishment"/>:<article className="access-card"><div className="access-card-heading"><h2>{tab==='punish'?'Punish player':tab==='unpunish'?'Unpunish player':'Punishment history'}</h2></div>
 {tab!=='history'&&<div className="punish-tabs" role="group" aria-label="Punishment category"><button type="button" className={category==='mute'?'selected':''} aria-pressed={category==='mute'} onClick={()=>{setCategory('mute');setType('');setResult(null)}}>Mute</button><button type="button" className={category==='ban'?'selected':''} aria-pressed={category==='ban'} onClick={()=>{setCategory('ban');setType('');setResult(null)}}>Ban</button></div>}
 <form className="punish-form" onSubmit={tab==='history'?e=>{e.preventDefault();void loadHistory(0)}:submit}><label>Minecraft username<input required minLength={3} maxLength={16} pattern="[A-Za-z0-9_]{3,16}" value={username} onChange={e=>{setUsername(e.target.value);setHistory(null)}} placeholder="Enter username" autoComplete="off"/></label>{tab!=='history'&&<label>Punishment category<select value={selectedType} onChange={e=>setType(e.target.value)}>{matchingTypes.map(t=><option key={t} value={t}>{t.replaceAll('_',' ')}</option>)}</select></label>}<button className={tab==='unpunish'?'access-danger':'access-primary'} disabled={busy||!valid(username)||(tab!=='history'&&(!canExecute||!categoriesLoaded||!selectedType))}>{tab==='history'?<Search size={16}/>:tab==='punish'?<Gavel size={16}/>:<Undo2 size={16}/>} {busy?'Working…':tab==='punish'?'Punish':tab==='unpunish'?'Unpunish':'View history'}</button></form>
 {catalogError&&<div className="access-notice bad" role="status">{catalogError}</div>}
 {result&&<div className={'access-notice '+(result.ok?'good':'bad')} role="status">{result.message}</div>}
 {tab==='history'&&<div className="punish-history"><div className="punish-history-header"><div><h2>{history?`History for ${history.username}`:'History results'}</h2><p>{history?`${history.total} entries` : ''}</p></div><input aria-label="Filter displayed history" placeholder="Filter entries on this page" value={filter} onChange={e=>setFilter(e.target.value)}/></div><div className="punish-history-scroll">{filtered.map((item,i)=><div className="punish-history-entry" key={`${item.timestamp}-${i}`}><time>{new Date(item.timestamp).toLocaleString()}</time><pre>{clean(item.description)}</pre></div>)}{history&&filtered.length===0&&<p>No matching entries on this page.</p>}</div>{history&&<div className="punish-pagination"><span>Showing {offset+1}–{Math.min(offset+history.entries.length,history.total)} of {history.total}</span><button disabled={busy||offset===0} onClick={()=>void loadHistory(Math.max(0,offset-50))}><ChevronLeft size={16}/> Previous</button><button disabled={busy||history.nextOffset<0} onClick={()=>void loadHistory(history.nextOffset)}>Next <ChevronRight size={16}/></button></div>}</div>}
 </article>}</section>;
}
