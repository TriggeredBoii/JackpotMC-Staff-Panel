import { readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
const roots=['dist'];
async function walk(dir){let entries;try{entries=await readdir(dir,{withFileTypes:true})}catch{return}for(const e of entries){const p=join(dir,e.name);if(e.isDirectory())await walk(p);else if(e.name==='.dev.vars'||e.name.startsWith('.dev.vars.')||e.name==='.env'||(e.name.startsWith('.env.')&&e.name!=='.env.example')){await rm(p,{force:true});console.log(`Removed secret file from build: ${p}`)}}}
for(const root of roots)await walk(root);
