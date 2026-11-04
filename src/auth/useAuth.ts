import {primeStaffPolicy} from '../pages/Access';
import {refreshPunishmentCatalog,clearPunishmentCatalog,setPunishmentCatalogAccount} from '../data/punishmentCatalog';
import {createContext,useContext,useEffect,useState,createElement,ReactNode,useMemo} from 'react';
export type Staff={panelAccess:boolean;breakGlass:boolean;rank:string;linked:boolean;minecraftUuid?:string;minecraftUsername?:string;permissions:string[];roleIds:string[]};
export type Me={authenticated:true;user:{id:string;username:string;displayName:string;avatar:string|null};csrf:string;staff:Staff};
type AuthValue={me:Me|null;realMe:Me|null;loading:boolean;preview:string|null;setPreview:(rank:string|null)=>void;previewRanks:string[]};
const Auth=createContext<AuthValue>({me:null,realMe:null,loading:true,preview:null,setPreview:()=>{},previewRanks:[]});
export function AuthProvider({children}:{children:ReactNode}){
 const [me,setMe]=useState<Me|null>(null),[loading,setLoading]=useState(true);
 const [preview,setPreview]=useState<string|null>(null);
 const [rankPermissions,setRankPermissions]=useState<Record<string,{level:number;permissions:string[]}>>({});
 useEffect(()=>{if(!me||!['MANAGER','OWNER'].includes(me.staff.rank)||!me.staff.permissions.includes('access.read')){setRankPermissions({});setPreview(null);return;}let live=true;fetch('/api/access',{credentials:'same-origin'}).then(r=>r.ok?r.json():null).then(body=>{if(live&&body?.ok&&body.data?.ranks)setRankPermissions(body.data.ranks)}).catch(()=>{});return()=>{live=false}},[me?.staff.rank,me?.user.id]);
 const previewRanks=useMemo(()=>{if(!me)return [];const current=rankPermissions[me.staff.rank]?.level??0;return Object.entries(rankPermissions).filter(([rank,value])=>rank!==me.staff.rank&&value.level<current&&value.permissions.includes('panel.access')).sort((a,b)=>b[1].level-a[1].level).map(([rank])=>rank)},[me,rankPermissions]);
 const shown=useMemo(()=>{if(!me||!preview||!previewRanks.includes(preview))return me;const target=rankPermissions[preview];const perms=new Set<string>();for(const rank of Object.values(rankPermissions))if(rank.level<=target.level)rank.permissions.forEach(x=>perms.add(x));return {...me,staff:{...me.staff,rank:preview,permissions:[...perms]}}},[me,preview,previewRanks,rankPermissions]);
 useEffect(()=>{let active=true; async function refresh(){try{const r=await fetch('/api/me',{credentials:'same-origin',cache:'no-store'});const next=r.ok?await r.json():null;if(active){setMe(next);if(next?.staff?.panelAccess){setPunishmentCatalogAccount(next.user.id);primeStaffPolicy(next.user.id);void refreshPunishmentCatalog();if(next.staff.permissions.includes('monitoring.view'))void fetch('/api/monitoring',{credentials:'same-origin'}).catch(()=>{})}else{setPunishmentCatalogAccount(null);primeStaffPolicy(null);clearPunishmentCatalog()}}}catch{if(active)setMe(null)}finally{if(active)setLoading(false)}} void refresh();const timer=setInterval(refresh,30000);return()=>{active=false;clearInterval(timer)}},[]);
 return createElement(Auth.Provider,{value:{me:shown,realMe:me,loading,preview:previewRanks.includes(preview||'')?preview:null,setPreview,previewRanks}},children);
}
export function useAuth(){return useContext(Auth)}
export function usePermission(permission:string){const {me}=useAuth();return me?.staff.permissions.includes(permission)===true}
