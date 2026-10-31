// Synthetic local QA only: real route handlers and SQL, PGlite in memory, simulated AI.
import {createServer} from 'node:http';
import {registerHooks} from 'node:module';
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import path from 'node:path';
import {existsSync} from 'node:fs';
if(process.env.OPENAI_API_KEY||process.env.DATABASE_URL)throw Error('Use a clean shell; this preview refuses external credentials.');
const root=fileURLToPath(new URL('../../',import.meta.url));
const stub=new URL('./learning-fixture.mjs',import.meta.url).href;
const hook=registerHooks({resolve(specifier,context,next){
 if(specifier==='server-only')return {url:'data:text/javascript,export {}',shortCircuit:true};
 if(/\/.test-artifacts\/app\/api\/lume\/(?:.*\/)?route.mjs$/.test(context.parentURL||'')&&['database.mjs','auth.mjs','ai.mjs'].includes(specifier.split('/').at(-1)))return {url:stub,shortCircuit:true};
 return next(specifier,context);
}});
const {pg}=await import('./learning-fixture.mjs');
for(const file of (await readdir(new URL('../../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await pg.exec(await readFile(new URL('../../migrations/'+file,import.meta.url),'utf8'));
const handlers=new Map();
for(const suffix of ['', '/learning','/backup','/materials','/materials/files','/uploads'])handlers.set('/api/lume'+suffix,await import(new URL('../../.test-artifacts/app/api/lume'+suffix+'/route.mjs',import.meta.url)));
hook.deregister();process.env.DATABASE_URL='synthetic-local-fixture';
await pg.query("INSERT INTO decks(id,owner,title,source,created) VALUES ('preview-learning','local-test','Física · prévia sintética','A corrente no circuito é -1 mA.',0)");
await pg.query("INSERT INTO cards(id,owner,deck_id,front,back,due) VALUES ('preview-card','local-test','preview-learning','Qual a corrente no circuito?','-1 mA',0)");
await mkdir(root+'.test-artifacts/browser',{recursive:true});
const entry="import React from 'react';import{createRoot}from'react-dom/client';import Lume from './app/lume';createRoot(document.getElementById('root')).render(<Lume/>);";
// Resolve via Node because the restricted Windows helper cannot traverse ancestor folders.
const resolveRequire=createRequire(root+'package.json');
const sourceLoader={name:'local-source',setup(builder){
 builder.onResolve({filter:/.*/},args=>{
  const parent=args.importer?path.dirname(args.importer):root;
  if(args.path.startsWith('.')){const p=path.resolve(parent,args.path);const selected=['','.tsx','.ts','.mjs','.js'].map(ext=>p+ext).find(existsSync);if(selected)return {path:selected,namespace:'local-source'};}
  return {path:resolveRequire.resolve(args.path,{paths:[parent,root]}),namespace:'local-source'};
 });
 builder.onLoad({filter:/.*/,namespace:'local-source'},async args=>({contents:await readFile(args.path,'utf8'),loader:args.path.endsWith('.tsx')?'tsx':args.path.endsWith('.ts')?'ts':args.path.endsWith('.json')?'json':'js'}));
}};
const compiled=await build({absWorkingDir:root,tsconfigRaw:{compilerOptions:{jsx:'react-jsx'}},stdin:{contents:entry,loader:'tsx',resolveDir:root},plugins:[sourceLoader],bundle:true,jsx:'automatic',platform:'browser',format:'esm',write:false,define:{'process.env.NODE_ENV':'"development"'}});
await writeFile(root+'.test-artifacts/browser/app.js',compiled.outputFiles[0].contents);
const css=(await readFile(root+'app/globals.css','utf8')).replace("@import 'tailwindcss';",'')+'\n'+await readFile(root+'app/workspace.css','utf8');
await writeFile(root+'.test-artifacts/browser/style.css',css);
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://127.0.0.1:5173'),route=handlers.get(url.pathname);
  if(route){const chunks=[];for await(const c of req)chunks.push(c);const bytes=Buffer.concat(chunks);const response=await route[req.method](new Request(url,{method:req.method,headers:req.headers,...(bytes.length?{body:bytes}:{} )}));res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;}
  if(url.pathname==='/app.js'||url.pathname==='/style.css'){res.setHeader('Content-Type',url.pathname.endsWith('.js')?'text/javascript':'text/css');res.end(await readFile(root+'.test-artifacts/browser'+url.pathname));return;}
  res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html lang="pt-BR"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lume · prévia sintética</title><div style="background:#312442;color:white;padding:8px;text-align:center">PRÉVIA LOCAL · dados sintéticos · IA simulada</div><link rel="stylesheet" href="/style.css"><div id="root"></div><script type="module" src="/app.js"></script></html>');
 }catch(e){console.error(e.name,e.message);res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Falha na prévia sintética.'}));}
});
server.listen(5173,'127.0.0.1',()=>console.log('Synthetic preview ready: http://127.0.0.1:5173'));
process.on('SIGTERM',()=>server.close(()=>pg.close()));
