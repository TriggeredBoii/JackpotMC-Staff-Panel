import {useEffect,useState} from 'react';
export type Me={authenticated:true;user:{id:string;username:string;displayName:string;avatar:string|null};csrf:string};
export function useAuth(){const [me,setMe]=useState<Me|null>(null);const [loading,setLoading]=useState(true);useEffect(()=>{fetch('/api/me',{credentials:'same-origin'}).then(async r=>r.ok?setMe(await r.json()):setMe(null)).finally(()=>setLoading(false));},[]);return{me,loading};}
