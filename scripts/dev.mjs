import {spawn} from 'node:child_process';
import {existsSync,readFileSync} from 'node:fs';
import path from 'node:path';
import {loadEnvFile} from 'node:process';
import {fileURLToPath} from 'node:url';
// Development only: root key stays at its already-approved destination.
const localConfig=fileURLToPath(new URL('../.env.local',import.meta.url));if(existsSync(localConfig))loadEnvFile(localConfig);
const approved=fileURLToPath(new URL('../../../.env.local',import.meta.url));
// The authorized working copy reads existing local configuration in memory; it never copies secrets.
const originManifest=fileURLToPath(new URL('../ORIGEM-DA-COPIA.json',import.meta.url));
if(existsSync(originManifest)){
 const {source}=JSON.parse(readFileSync(originManifest,'utf8'));
 if(typeof source!=='string'||!path.isAbsolute(source))throw Error('Origem da cópia inválida.');
 for(const envFile of [path.resolve(source,'../..','.env.local'),path.join(source,'.env.local')])if(existsSync(envFile))loadEnvFile(envFile);
}else if(existsSync(approved))loadEnvFile(approved);
const cli=fileURLToPath(new URL('../node_modules/next/dist/bin/next',import.meta.url));
const child=spawn(process.execPath,[cli,'dev','--hostname','127.0.0.1','--port','5173'],{stdio:'inherit',env:{...process.env,LUME_LOCAL_TEST:'1',NEXT_TELEMETRY_DISABLED:'1'}});
child.on('exit',code=>process.exit(code??1));

