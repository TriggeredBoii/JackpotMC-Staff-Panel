import {refreshPunishmentCatalog,clearPunishmentCatalog} from '../data/punishmentCatalog';
import {createContext,useContext,useEffect,useState,createElement,ReactNode,useCallback} from 'react';
export type Staff={panelAccess:boolean;breakGlass:boolean;rank:string;linked:boolean;minecraftUuid?:string;minecraftUsername?:string;permissions:string[];roleIds:string[]};
export type Me={authenticated:true;user:{id:string;username:string;displayName:string;avatar:string|null};csrf:string;staff:Staff};
type Rank='MODERATOR'|'SRMOD'|'ADMIN'|'SRADMIN'|'MANAGER'|'OWNER';
const Auth=createContext<{me:Me|null;realMe:Me|null;loading:boolean;preview:Rank|null;setPreview:(rank:Rank|null)=>void;previewRanks:Rank[]}>({me:null,realMe:null,loading:true,preview:null,setPreview:()=>{},previewRanks:[]});
export function AuthProvider({children}:{children:ReactNode}){
 const [me,setMe]=useState<Me|null>(null),[loading,setLoading]=useState(true);
 const [preview,setPreviewState]=useState<Rank|null>(null);
 const [policy,setPolicy]=useState<Record<string,{permissions:string[]}>|null>(null);
 const allowed=me?.staff.rank==='MANAGER'||me?.staff.rank==='OWNER';
 const setPreview=useCallback((rank:Rank|null)=>setPreviewState(rank),[]);
 useEffect(()=>{if(!allowed){setPreviewState(null);setPolicy(null);return}let live=true;fetch('/api/access',{credentials:'same-origin',cache:'no-store'}).then(r=>r.ok?r.json():null).then(r=>{if(live&&r?.ok&&r.data?.ranks)setPolicy(r.data.ranks)}).catch(()=>{});return()=>{live=false}},[allowed,me?.user.id]);
 const projected=preview&&allowed&&policy?.[preview]&&me?{...me,staff:{...me.staff,rank:preview,permissions:policy[preview].permissions.filter(p=>p!=='panel.access'),panelAccess:true}}:me;
 const previewRanks:Rank[]=allowed&&policy?(['MODERATOR','SRMOD','ADMIN','SRADMIN','MANAGER','OWNER'] as Rank[]).filter(r=>!!policy[r]):[];
 useEffect(()=>{let active=true; async function refresh(){try{const r=await fetch('/api/me',{credentials:'same-origin',cache:'no-store'});const next=r.ok?await r.json():null;if(active){setMe(next);if(next?.staff?.panelAccess)void refreshPunishmentCatalog();else clearPunishmentCatalog()}}catch{if(active)setMe(null)}finally{if(active)setLoading(false)}} void refresh();const timer=setInterval(refresh,30000);return()=>{active=false;clearInterval(timer)}},[]);
 return createElement(Auth.Provider,{value:{me:projected,realMe:me,loading,preview:projected!==me?preview:null,setPreview,previewRanks}},children);
}
export function useAuth(){return useContext(Auth)}
export function usePermission(permission:string){const {me}=useAuth();return me?.staff.permissions.includes(permission)===true}
