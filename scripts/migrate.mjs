import {Pool} from 'pg';
import {readFile,readdir} from 'node:fs/promises';
const connectionString=process.env.DATABASE_URL_UNPOOLED;
if(!connectionString)throw new Error('DATABASE_URL_UNPOOLED não configurada.');
const pool=new Pool({connectionString,max:1});
try{for(const name of (await readdir(new URL('../migrations/',import.meta.url))).filter(name=>name.endsWith('.sql')).sort()){await pool.query(await readFile(new URL('../migrations/'+name,import.meta.url),'utf8'));console.log('Migração concluída:',name);}}catch(e){console.error('Falha na migração:',e.code||e.name);process.exitCode=1;}finally{await pool.end();}
