import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const base='http://127.0.0.1:5173/api/lume',path='/materials/files';
const deckId=crypto.randomUUID(),title='QA arquivos '+deckId,description='Fixture temporária de arquivo persistente.';
const files=new Set();
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
async function call(endpoint,body,method=body===undefined?'GET':'POST'){
 const response=await fetch(base+endpoint,{method,redirect:'error',headers:body===undefined?{}:{'Content-Type':method==='PUT'?'application/octet-stream':'application/json'},body:body===undefined?undefined:method==='PUT'?body:JSON.stringify(body),signal:AbortSignal.timeout(45000)});
 assert.match(response.headers.get('content-type')||'',/application\/json/);return {status:response.status,data:await response.json()};
}
async function ok(endpoint,body,method){const r=await call(endpoint,body,method);assert.equal(r.status,200,r.data.error);return r.data;}
async function state(){const r=await ok('');assert.equal(r.name,'Prévia local');return r;}
function makePdf(){
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R >>','<< /Length 0 >>\nstream\n\nendstream'];
 let text='%PDF-1.4\n',offsets=[];for(const [i,object]of objects.entries()){offsets.push(Buffer.byteLength(text));text+=`${i+1} 0 obj\n${object}\nendobj\n`;}
 const xref=Buffer.byteLength(text);text+='xref\n0 5\n0000000000 65535 f \n'+offsets.map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;return Buffer.from(text);
}
async function start(id,bytes,name='fixture.pdf',type='application/pdf'){files.add(id);return call(path,{action:'start',id,deckId,name,type,bytes});}
async function part(id,index,bytes){return call(path+'?id='+encodeURIComponent(id)+'&deckId='+encodeURIComponent(deckId)+'&part='+index,bytes,'PUT');}
let created=false;
try{
 await state();await ok('',{action:'createDeck',id:deckId,title,description,color:'blue'});created=true;
 const tooLargePdf=await start(crypto.randomUUID(),100_000_001);assert.equal(tooLargePdf.status,400);
 const tooLargeImage=await start(crypto.randomUUID(),3_000_001,'fixture.png','image/png');assert.equal(tooLargeImage.status,400);
 assert.equal((await start(crypto.randomUUID(),0)).status,400);
 console.log('PASS: metadados acima de 100 MB PDF/3 MB imagem e tamanho zero rejeitados sem upload.');
 const id=crypto.randomUUID(),bytes=makePdf();assert.equal((await start(id,bytes.length)).status,200);
 assert.equal((await start(id,bytes.length)).status,200);
 assert.equal((await start(id,bytes.length+1)).status,409);
 assert.equal((await call(path,{action:'complete',id,deckId})).status,409);
 assert.equal((await call(path+'?id='+encodeURIComponent(id))).status,404);
 assert.equal((await part(id,1,bytes)).status,400);
 assert.equal((await part(id,0,bytes.subarray(1))).status,400);
 const wrongType=Buffer.from(bytes);wrongType[0]=88;assert.equal((await part(id,0,wrongType)).status,400);
 assert.equal((await call(path+'?id='+encodeURIComponent(id)+'&deckId='+encodeURIComponent(deckId),bytes,'PUT')).status,400,'REG-FILE-001: índice da parte é obrigatório; ausência não pode significar zero.');
 for(const invalid of ['', ' ', '0.0', '-0', 'abc'])assert.equal((await part(id,encodeURIComponent(invalid),bytes)).status,400,'REG-FILE-001: índice vazio ou malformado deve ser rejeitado.');
 assert.equal((await part(id,0,bytes)).status,200);assert.equal((await part(id,0,bytes)).status,200);
 const different=Buffer.from(bytes);different[different.length-2]=32;assert.equal((await part(id,0,different)).status,409);
 let completed=await ok(path,{action:'complete',id,deckId});assert.equal(completed.file.sha256,digest(bytes));assert.equal(completed.file.status,'ready');
 completed=await ok(path,{action:'complete',id,deckId});assert.equal(completed.file.sha256,digest(bytes));
 const downloaded=await fetch(base+path+'?id='+encodeURIComponent(id),{redirect:'error',signal:AbortSignal.timeout(45000)});
 assert.equal(downloaded.status,200);assert.equal(downloaded.headers.get('x-content-type-options'),'nosniff');assert.match(downloaded.headers.get('content-disposition')||'',/^attachment;/);
 const body=Buffer.from(await downloaded.arrayBuffer());assert.equal(body.length,bytes.length);assert.equal(digest(body),digest(bytes));
 assert.equal((await call(path+'?id='+encodeURIComponent(id)+'&view=inline')).status,400);
 const imageId=crypto.randomUUID(),imageBytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jGZkAAAAASUVORK5CYII=','base64');
 assert.equal((await start(imageId,imageBytes.length,'fixture.png','image/png')).status,200);
 assert.equal((await call(path+'?id='+encodeURIComponent(imageId)+'&view=inline')).status,404);
 assert.equal((await part(imageId,0,imageBytes)).status,200);await ok(path,{action:'complete',id:imageId,deckId});
 const inline=await fetch(base+path+'?id='+encodeURIComponent(imageId)+'&view=inline',{redirect:'error',signal:AbortSignal.timeout(45000)});
 assert.equal(inline.status,200);assert.equal(inline.headers.get('content-type'),'image/png');assert.match(inline.headers.get('content-disposition')||'',/^inline;/);assert.equal(inline.headers.get('cache-control'),'private, no-store');assert.equal(digest(Buffer.from(await inline.arrayBuffer())),digest(imageBytes));
 await ok(path,{action:'delete',id:imageId,deckId});files.delete(imageId);assert.equal((await call(path+'?id='+encodeURIComponent(imageId)+'&view=inline')).status,404);
 console.log('PASS: imagem PNG inline autenticada com bytes preservados; envio incompleto, PDF inline e imagem removida rejeitados.');
 const manifests=await ok('/materials?deckId='+encodeURIComponent(deckId));assert.equal(manifests.files.filter(f=>f.id===id).length,1);
 await ok(path,{action:'delete',id,deckId});files.delete(id);assert.equal((await call(path+'?id='+encodeURIComponent(id))).status,404);
 console.log('PASS: PDF pequeno persistido e baixado com hash idêntico; reenvio idempotente, conflitos, partes inválidas, envio incompleto e exclusão verificados.');
}finally{
 if(created){
  const snapshot=await state(),deck=snapshot.decks.find(d=>d.id===deckId);assert.equal(deck?.title,title);assert.equal(deck?.description,description);
  for(const id of files){const deleted=await call(path,{action:'delete',id,deckId});assert.ok([200,404].includes(deleted.status));}
  await ok('',{action:'deleteDeck',deckId});assert.equal((await state()).decks.some(d=>d.id===deckId),false);
  console.log('Fixtures de arquivos removidas por IDs conhecidos.');
 }
}
