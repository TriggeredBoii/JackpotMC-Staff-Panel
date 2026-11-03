export function harden(response:Response){
 const h=new Headers(response.headers);
 h.set('X-Content-Type-Options','nosniff'); h.set('X-Frame-Options','DENY'); h.set('Referrer-Policy','no-referrer');
 h.set('Permissions-Policy','camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=()');
 h.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https://cdn.discordapp.com data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self' https://discord.com; upgrade-insecure-requests");
 h.set('Cache-Control','no-store'); h.set('Cross-Origin-Opener-Policy','same-origin'); h.set('Cross-Origin-Resource-Policy','same-origin');
 h.set('X-Permitted-Cross-Domain-Policies','none');
 return new Response(response.body,{status:response.status,statusText:response.statusText,headers:h});
}
