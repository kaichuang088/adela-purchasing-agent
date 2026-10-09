import {mkdirSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';

const root=process.cwd();
const required=['CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_API_TOKEN','KK_D1_DATABASE_ID','ADMIN_PASSWORD'];
const missing=required.filter(key=>!process.env[key]);
if(missing.length)throw new Error(`Missing deployment environment: ${missing.join(', ')}`);
if(!process.env.OPENAI_API_KEY&&!process.env.KK_AI_GATEWAY_URL)throw new Error('Set OPENAI_API_KEY or KK_AI_GATEWAY_URL for live AI pricing.');

function run(command,args,options={}){
 const result=spawnSync(command,args,{cwd:root,stdio:options.input?'pipe':'inherit',encoding:'utf8',input:options.input,env:process.env});
 if(result.error)throw result.error;
 if(result.status!==0){if(options.input&&result.stderr)process.stderr.write(result.stderr);process.exit(result.status??1);}
 return result.stdout||'';
}

run('pnpm',['build']);
const generated=resolve(root,'.wrangler','generated');mkdirSync(generated,{recursive:true});
const config=resolve(generated,'kk-production.json');
const workerConfig={
 name:process.env.KK_WORKER_NAME||'kk-purchasing-agent',
 main:'../../dist/server/index.js',
 compatibility_date:'2026-09-01',
 compatibility_flags:['nodejs_compat'],
 account_id:process.env.CLOUDFLARE_ACCOUNT_ID,
 assets:{directory:'../../dist/client',binding:'ASSETS',run_worker_first:true},
 d1_databases:[{binding:'DB',database_name:process.env.KK_D1_DATABASE_NAME||'kk-purchasing-agent',database_id:process.env.KK_D1_DATABASE_ID,migrations_dir:'../../drizzle'}],
 triggers:{crons:['* * * * *']},
 observability:{enabled:true},
};
if(process.env.KK_R2_BUCKET_NAME)workerConfig.r2_buckets=[{binding:'BUCKET',bucket_name:process.env.KK_R2_BUCKET_NAME}];
writeFileSync(config,JSON.stringify(workerConfig,null,2));

run('pnpm',['exec','wrangler','d1','migrations','apply',process.env.KK_D1_DATABASE_NAME||'kk-purchasing-agent','--remote','--config',config]);
run('pnpm',['exec','wrangler','deploy','--config',config]);
run('pnpm',['exec','wrangler','secret','bulk','--config',config],{input:JSON.stringify({ADMIN_PASSWORD:process.env.ADMIN_PASSWORD,OPENAI_API_KEY:process.env.OPENAI_API_KEY,OPENAI_MODEL:process.env.OPENAI_MODEL||'gpt-5.5',KK_AI_GATEWAY_URL:process.env.KK_AI_GATEWAY_URL,KK_AI_GATEWAY_SECRET:process.env.KK_AI_GATEWAY_SECRET})});
