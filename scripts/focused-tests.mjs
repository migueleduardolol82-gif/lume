import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const input=process.argv.slice(2),separator=input.indexOf('--name');
const files=separator<0?input:input.slice(0,separator),pattern=separator<0?null:input[separator+1];
if(!files.length||separator>=0&&(separator!==input.length-2||!pattern))throw Error('Use: npm run test:focus -- tests/arquivo.ts [--name REG-ID]');
for(const file of files)if(!/^tests\/[a-z0-9-]+\.(ts|mjs)$/.test(file)||!existsSync(path.join(root,file))||file.endsWith('.mjs')&&!file.endsWith('-ui.mjs')&&!file.endsWith('-offline.mjs')&&!file.endsWith('/api-card-contract.mjs'))throw Error('Escolha um teste offline explícito em tests/. Integração e IA real usam comandos separados.');
const guard='import net from "node:net"; const deny=()=>{throw Error("Rede desabilitada nos testes offline");}; net.Socket.prototype.connect=deny; globalThis.fetch=async()=>deny();';
const env={...process.env,NEXT_TELEMETRY_DISABLED:'1'};
for(const key of Object.keys(env))if(/OPENAI|DATABASE_URL|VERCEL_TOKEN|API_KEY/.test(key))delete env[key];
async function run(args){await new Promise((resolve,reject)=>{const child=spawn(process.execPath,args,{cwd:root,env,stdio:'inherit',shell:false});child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(Error('Teste focado falhou.')));});}
try{
 if(files.some(f=>f.endsWith('.mjs')))await run(['scripts/compile-ui-tests.mjs']);
 await run(['--import','data:text/javascript,'+encodeURIComponent(guard),'--experimental-transform-types','--test',...(pattern?['--test-name-pattern',pattern]:[]),...files]);
}catch(e){console.error(e.message);process.exitCode=1;}
