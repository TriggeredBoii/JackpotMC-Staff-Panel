import {useEffect,useState} from 'react';

type Category='mute'|'ban'|'warn';
type Result={ok:boolean;data?:unknown;message?:string};
type Snapshot={types:string[];categories:Record<string,Category>;loaded:boolean;error:string|null};
const EMPTY:Snapshot={types:[],categories:{},loaded:false,error:null};
let snapshot:Snapshot=EMPTY;
let inflight:Promise<void>|null=null;
let lastSuccess=0;
const listeners=new Set<()=>void>();
const notify=()=>{for(const listener of listeners)listener()};
const TTL=30_000;

export function clearPunishmentCatalog(){snapshot=EMPTY;lastSuccess=0;notify()}
export async function refreshPunishmentCatalog(force=false):Promise<void>{
 if(inflight)return inflight;
 if(!force&&snapshot.loaded&&Date.now()-lastSuccess<TTL)return;
 inflight=(async()=>{
  try{
   const [typeResponse,categoryResponse]=await Promise.all([
    fetch('/api/punishments/types',{credentials:'same-origin',cache:'no-store'}),
    fetch('/api/punishments/categories',{credentials:'same-origin',cache:'no-store'})
   ]);
   if(typeResponse.status===401||typeResponse.status===403||categoryResponse.status===401||categoryResponse.status===403){clearPunishmentCatalog();return}
   if(!typeResponse.ok||!categoryResponse.ok)throw Error('Unable to refresh punishment categories.');
   const [typesResult,categoriesResult]=await Promise.all([typeResponse.json(),categoryResponse.json()]) as [Result,Result];
   if(!typesResult.ok||!Array.isArray(typesResult.data)||!categoriesResult.ok||!categoriesResult.data||typeof categoriesResult.data!=='object'||Array.isArray(categoriesResult.data))throw Error('Invalid punishment category response.');
   const categories:Record<string,Category>={};
   for(const [name,category] of Object.entries(categoriesResult.data))if(category==='mute'||category==='ban'||category==='warn')categories[name]=category;
   snapshot={types:typesResult.data.filter((x):x is string=>typeof x==='string'),categories,loaded:true,error:null};
   lastSuccess=Date.now();notify();
  }catch(e){snapshot={...snapshot,error:e instanceof Error?e.message:'Could not load punishment categories.'};notify()}
 })().finally(()=>{inflight=null});
 return inflight;
}
export function usePunishmentCatalog(enabled:boolean){
 const [value,setValue]=useState<Snapshot>(()=>snapshot);
 useEffect(()=>{
  if(!enabled)return;
  const update=()=>setValue(snapshot);listeners.add(update);update();
  void refreshPunishmentCatalog();
  const interval=setInterval(()=>{if(document.visibilityState==='visible')void refreshPunishmentCatalog()},30_000);
  const visible=()=>{if(document.visibilityState==='visible')void refreshPunishmentCatalog(true)};
  document.addEventListener('visibilitychange',visible);
  return()=>{listeners.delete(update);clearInterval(interval);document.removeEventListener('visibilitychange',visible)};
 },[enabled]);
 return value;
}
