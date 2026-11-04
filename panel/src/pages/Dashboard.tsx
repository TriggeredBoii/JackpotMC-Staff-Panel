import {useEffect,useState} from 'react';
import {useAuth} from '../auth/useAuth';
export default function Dashboard(){
 const {me}=useAuth();
 const [health,setHealth]=useState<'checking'|'online'|'offline'>('checking');
 useEffect(()=>{fetch('/api/health').then(r=>setHealth(r.ok?'online':'offline')).catch(()=>setHealth('offline'));},[]);
 return <section className="page"><div className="title"><div><p>OVERVIEW</p><h1>Dashboard</h1><span>JackpotMC staff operations and administration.</span></div></div><div className="grid"><article className="card"><span>Panel status</span><strong className={health}>{health}</strong><small>Cloudflare Worker API</small></article><article className="card"><span>Staff Bot</span><strong className={me?.staff.panelAccess?'online':'offline'}>{me?.staff.panelAccess?'authorized':'denied'}</strong><small>{me?.staff.panelAccess?'Authorized by Staff Bot during session verification':'Authorization unavailable'}</small></article><article className="card"><span>Protocol</span><strong>V2</strong><small>HMAC-SHA-512 + replay protection</small></article></div><article className="wide"><h2>Secure integration</h2><p>{me?.staff.panelAccess?`Connected as ${me.staff.minecraftUsername||'linked staff'}. Existing Discord commands remain independent and continue to work normally.`:'The website will fail closed until the Staff Bot verifies your linked account, active staff status and panel permission.'}</p></article></section>;
}
