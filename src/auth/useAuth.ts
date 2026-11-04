import {refreshPunishmentCatalog,clearPunishmentCatalog} from '../data/punishmentCatalog';
import {createContext,useContext,useEffect,useState,createElement,ReactNode} from 'react';
export type Staff={panelAccess:boolean;breakGlass:boolean;rank:string;linked:boolean;minecraftUuid?:string;minecraftUsername?:string;permissions:string[];roleIds:string[]};
export type Me={authenticated:true;user:{id:string;username:string;displayName:string;avatar:string|null};csrf:string;staff:Staff};
const Auth=createContext<{me:Me|null;loading:boolean}>({me:null,loading:true});
export function AuthProvider({children}:{children:ReactNode}){
 const [me,setMe]=useState<Me|null>(null),[loading,setLoading]=useState(true);
 useEffect(()=>{let active=true; async function refresh(){try{const r=await fetch('/api/me',{credentials:'same-origin',cache:'no-store'});const next=r.ok?await r.json():null;if(active){setMe(next);if(next?.staff?.panelAccess)void refreshPunishmentCatalog();else clearPunishmentCatalog()}}catch{if(active)setMe(null)}finally{if(active)setLoading(false)}} void refresh();const timer=setInterval(refresh,30000);return()=>{active=false;clearInterval(timer)}},[]);
 return createElement(Auth.Provider,{value:{me,loading}},children);
}
export function useAuth(){return useContext(Auth)}
export function usePermission(permission:string){const {me}=useAuth();return me?.staff.permissions.includes(permission)===true}
