export function cookies(request:Request){ const raw=request.headers.get('Cookie')||''; return Object.fromEntries(raw.split(';').map(v=>v.trim()).filter(Boolean).map(v=>{const i=v.indexOf('=');return [decodeURIComponent(v.slice(0,i)),decodeURIComponent(v.slice(i+1))]})); }
export function sessionCookie(value:string,maxAge=7200){ return `jmc_session=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`; }
export function stateCookie(value:string){ return `jmc_oauth_state=${encodeURIComponent(value)}; Path=/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=600`; }
export function clearSession(){ return `jmc_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`; }
export function clearState(){ return `jmc_oauth_state=; Path=/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=0`; }
