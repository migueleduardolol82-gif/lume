import {spawn} from 'node:child_process';
import {readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const mode=process.argv[2]||'regression';
const modes=new Set(['regression','unit','integration','live-ai','quality-ai']);
if(!modes.has(mode))throw Error('Use regression, unit, integration, quality-ai ou live-ai.');
// Offline tests cannot accidentally open a socket, even when environment credentials exist.
const guard='import net from "node:net"; const deny=()=>{throw Error("Rede desabilitada nos testes offline");}; net.Socket.prototype.connect=deny; globalThis.fetch=async()=>deny();';
const offlineImport='data:text/javascript,'+encodeURIComponent(guard);
function run(args,{offline=false}={}){
 return new Promise((resolve,reject)=>{
  const env={...process.env,NEXT_TELEMETRY_DISABLED:'1'};
  if(offline)for(const key of Object.keys(env))if(/OPENAI|DATABASE_URL|VERCEL_TOKEN|API_KEY/.test(key))delete env[key];
  const child=spawn(process.execPath,[...(offline?['--import',offlineImport]:[]),...args],{cwd:root,stdio:'inherit',env,shell:false});
  child.once('error',reject);child.once('exit',(code,signal)=>code===0?resolve():reject(Error(`Etapa falhou (${signal||code}).`)));
 });
}
async function localIdentity(){
 const response=await fetch('http://127.0.0.1:5173/api/lume',{redirect:'error',signal:AbortSignal.timeout(45000)});
 if(!response.ok)throw Error('Servidor local indisponível; inicie a prévia antes da integração.');
 const data=await response.json();
 if(data.name!=='Prévia local')throw Error('Integração exige identidade Prévia local; nenhuma escrita foi realizada.');
}
try{
 if(mode==='regression'||mode==='unit'){
  const files=(await readdir(new URL('../tests/',import.meta.url))).filter(name=>name.endsWith('.ts')).sort().map(name=>'tests/'+name);
  if(!files.length)throw Error('Nenhum teste offline encontrado.');
  console.log(`Testes offline: ${files.length} arquivos. Sem API real, banco ou rede.`);
  await run(['--experimental-transform-types','--test',...files],{offline:true});
  await run(['scripts/compile-ui-tests.mjs']);
  await run(['--test','tests/workspace-ui.mjs','tests/material-library-ui.mjs','tests/api-card-contract.mjs'],{offline:true});
  if(mode==='regression')await run(['node_modules/typescript/bin/tsc','--noEmit'],{offline:true});
 }else{
  await localIdentity();
  const files=mode==='integration'?['reliability-api.mjs','deck-edit-api.mjs','backup-api.mjs','content-import-api.mjs','subdecks-api.mjs','content-api.mjs','files-api.mjs','true-false-api.mjs','cloze-api.mjs','multi-select-api.mjs']:mode==='quality-ai'?['quality-live-ai.mjs','tutor-live-ai.mjs']:['api.mjs','large-pdf-api.mjs'];
  console.log(mode==='live-ai'?'Testes explícitos com IA real: podem consumir créditos e enviar PDF sintético de 50 MB.':mode==='quality-ai'?'Avaliação explícita de qualidade com IA real: duas fontes sintéticas; pode consumir créditos.':'Integração local: dados temporários identificados, sem geração de IA.');
  for(const file of files){await localIdentity();await run(['--experimental-transform-types','tests/'+file]);}
 }
 console.log('PASS: '+mode);
}catch(error){console.error(error.message);process.exitCode=1;}
