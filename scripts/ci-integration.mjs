import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
import {Pool} from 'pg';
// This runner is exclusively for the disposable PostgreSQL service in quality.yml.
const root=fileURLToPath(new URL('../',import.meta.url));
const url=new URL(process.env.DATABASE_URL||'file:///missing');
if(process.env.CI!=='true'||process.platform!=='linux'||url.hostname!=='localhost'||url.pathname!=='/lume_test'||url.username!=='lume_test'||url.searchParams.get('sslmode')!=='verify-full'||!url.searchParams.get('sslrootcert')||process.env.OPENAI_API_KEY)throw Error('Integração CI exige banco descartável localhost/lume_test com TLS verificado, sem chave de IA.');
const env={...process.env,DATABASE_URL_UNPOOLED:url.toString(),LUME_LOCAL_TEST:'1',NEXT_TELEMETRY_DISABLED:'1'};
delete env.VERCEL;delete env.LUME_OWNER_ID;delete env.LUME_OWNER_NAME;
async function run(args){const child=spawn(process.execPath,args,{cwd:root,env,stdio:'inherit'});const [code]=await once(child,'exit');if(code!==0)throw Error('Etapa da integração falhou: '+args[0]);}
const pool=new Pool({connectionString:url.toString(),max:1,connectionTimeoutMillis:10000});
try{const result=await pool.query('SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()');if(result.rows[0]?.ssl!==true)throw Error('Conexão PostgreSQL sem TLS.');console.log('PASS: PostgreSQL real com TLS verificado.');}finally{await pool.end();}
await run(['scripts/migrate.mjs']);
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port','5173'],{cwd:root,env,stdio:'inherit',detached:true});
let ready=false;
try{
 for(let attempt=0;attempt<120;attempt++){
  if(server.exitCode!==null)throw Error('A prévia encerrou antes dos testes.');
  try{const response=await fetch('http://127.0.0.1:5173/api/lume',{redirect:'error',signal:AbortSignal.timeout(5000)});if(response.ok){const data=await response.json();if(data.name!=='Prévia local')throw Error('Identidade de teste inválida.');ready=true;break;}}catch(error){if(error.message==='Identidade de teste inválida.')throw error;}
  await new Promise(resolve=>setTimeout(resolve,500));
 }
 if(!ready)throw Error('A prévia não ficou pronta para integração.');
 await run(['scripts/regression.mjs','integration']);
}finally{
 if(server.pid){try{process.kill(-server.pid,'SIGTERM');}catch(error){if(error.code!=='ESRCH')throw error;}}
}
