import{createRequire}from'node:module';import{realpathSync}from'node:fs';import{readFile,readdir}from'node:fs/promises';
const require=createRequire(realpathSync('node_modules/wrangler/package.json')),{Miniflare}=require('miniflare');
const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("test")}}',compatibilityDate:'2026-05-15',d1Databases:['DB'],cf:false});
try{const db=await mf.getD1Database('DB');for(const file of(await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort()){
 const parts=(await readFile('drizzle/'+file,'utf8')).split('--> statement-breakpoint').map(x=>x.trim()).filter(Boolean);
 if(file<'0016')for(const sql of parts)await db.prepare(sql).run();
 else {for(let i=0;i<parts.length;i++){const sql=parts[i].replace(/--[^\n]*/g,'').trim();try{await db.exec(sql);}catch(e){console.log('First incomplete migration statement:',file,'statement',i+1,'prefix',sql.slice(0,180));console.log(String(e).slice(0,1500));process.exitCode=1;throw e;}}console.log('PASS exec migration',file);}
}}catch{}finally{await mf.dispose();}
