import {mkdir,writeFile} from 'node:fs/promises';
const directory=new URL('../.test-artifacts/reports/',import.meta.url);
export async function writeAiReport(name,data){
 if(typeof name!=='string'||!/^[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*\.json$/.test(name))throw Error('Nome de relatório inválido.');
 await mkdir(directory,{recursive:true});
 const destination=new URL(name,directory);
 await writeFile(destination,JSON.stringify(data,null,2));
 return destination;
}
