import {Outlet} from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import {useAuth} from '../auth/useAuth';
export default function AppLayout(){
 const {realMe,loading,preview,setPreview,previewRanks}=useAuth();
 if(loading)return <div className="center">Checking secure session…</div>;
 if(!realMe){window.location.href='/login';return null;}
 return <div className="shell"><Sidebar/><main>
 <header><div/><div className="user"><div><b>{realMe.user.displayName}</b><span>{realMe.staff.rank} · {realMe.staff.minecraftUsername||'Minecraft unlinked'}</span></div><a href="/auth/logout">Sign out</a></div></header>
 {preview&&<div className="role-preview-banner"><strong>Currently showing as</strong><select aria-label="Preview staff rank" value={preview} onChange={e=>setPreview(e.target.value)}>{previewRanks.map(r=><option key={r} value={r}>{r}</option>)}</select><span>Read-only preview</span><button type="button" onClick={()=>setPreview(null)}>Exit</button></div>}
 {!preview&&previewRanks.length>0&&<div className="role-preview-start"><label>View as role <select aria-label="View as role" value="" onChange={e=>{if(e.target.value)setPreview(e.target.value)}}><option value="">Select role…</option>{previewRanks.map(r=><option key={r} value={r}>{r}</option>)}</select></label></div>}
 <div onClickCapture={e=>{if(preview&&(e.target as HTMLElement).closest('button, a[href]:not([href^="/punishments"]):not([href^="/staff"])')){e.preventDefault();e.stopPropagation()}}} onSubmitCapture={e=>{if(preview){e.preventDefault();e.stopPropagation()}}}><Outlet/></div>
 </main></div>;
}
