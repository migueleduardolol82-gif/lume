import {requestJson} from './sync';
import {FILE_LIMITS} from './content';
export async function uploadMaterialFile(deckId:string,file:File,onProgress:(percent:number)=>void){
 const type=file.type||(/\.pdf$/i.test(file.name)?'application/pdf':'');
 if(!['application/pdf','image/png','image/jpeg','image/webp'].includes(type))throw Error('Use PDF, PNG, JPEG ou WebP.');
 if(!file.size||file.size>(type==='application/pdf'?FILE_LIMITS.pdf:FILE_LIMITS.image))throw Error(type==='application/pdf'?'Use um PDF de até 100 MB.':'Use uma imagem de até 3 MB.');
 const id=crypto.randomUUID(),base='/api/lume/materials/files',post=(body:unknown)=>requestJson(base,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)},120000);
 try{await post({action:'start',deckId,id,name:file.name,type,bytes:file.size});
  for(let offset=0,part=0;offset<file.size;offset+=FILE_LIMITS.chunk,part++){await requestJson(`${base}?id=${encodeURIComponent(id)}&deckId=${encodeURIComponent(deckId)}&part=${part}`,{method:'PUT',headers:{'Content-Type':'application/octet-stream'},body:file.slice(offset,offset+FILE_LIMITS.chunk)},120000);onProgress(Math.round(Math.min(offset+FILE_LIMITS.chunk,file.size)/file.size*100));}
  await post({action:'complete',deckId,id});return id;
 }catch(error){try{await post({action:'delete',deckId,id});}catch{/* Incomplete uploads expire after one hour on the next upload. */}throw error;}
}
