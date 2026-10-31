import assert from 'node:assert/strict';
const base='http://127.0.0.1:5173/api/lume',deckId=crypto.randomUUID(),lessonId=crypto.randomUUID();
const title='QA aulas '+deckId;
async function call(path='',body,origin){const response=await fetch(base+path,{method:body?'POST':'GET',redirect:'error',headers:body?{'Content-Type':'application/json',...(origin?{origin}:{})}:{},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(45000)});return {status:response.status,data:await response.json()};}
async function state(){const response=await call();assert.equal(response.status,200);assert.equal(response.data.name,'Prévia local');return response.data;}
async function ok(path,body){const response=await call(path,body);assert.equal(response.status,200,response.data.error);return response.data;}
try{
 await state();await ok('',{action:'createDeck',id:deckId,title,color:'green'});
 await ok('',{action:'saveCards',deckId,cards:[{id:crypto.randomUUID(),front:'Qual a corrente sintética?',back:'-1 mA'}]});
 const create={action:'create',id:lessonId,deckId,kind:'lesson',title:'Aula de corrente sintética'};
 const created=await ok('/learning',create);assert.equal(created.session.payload.steps.length,1);
 assert.equal((await ok('/learning',create)).session.id,lessonId);
 const advance={action:'advance',id:lessonId,eventId:crypto.randomUUID(),revision:0,index:0,answer:'-1 mA',rating:'good'};
 assert.equal((await call('/learning',advance,'https://foreign.example')).status,403);
 assert.equal((await ok('/learning',advance)).session.payload.index,1);
 assert.equal((await ok('/learning',advance)).session.revision,1);
 assert.equal((await call('/learning',{...advance,eventId:crypto.randomUUID()})).status,409);
 const resumed=await ok('/learning?id='+lessonId);assert.equal(resumed.session.payload.answers[0].answer,'-1 mA');
 const exported=await ok('/backup');assert.ok(exported.learning.some(item=>item.id===lessonId&&item.payload.index===1));
 const {PDFDocument}=await import('../lib/vendor/pdf-lib.mjs');const document=await PDFDocument.create();document.addPage().drawText('A corrente sintetica e -1 mA.');document.addPage().drawText('A pressao sintetica e 20 kPa.');const bytes=await document.save(),fileId=crypto.randomUUID();
 await ok('/materials/files',{action:'start',id:fileId,deckId,name:'QA circuito.pdf',type:'application/pdf',bytes:bytes.length});
 const upload=await fetch(base+'/materials/files?id='+fileId+'&deckId='+deckId+'&part=0',{method:'PUT',headers:{'Content-Type':'application/octet-stream'},body:bytes,redirect:'error',signal:AbortSignal.timeout(45000)});assert.equal(upload.status,200);
 await ok('/materials/files',{action:'complete',id:fileId,deckId});
 assert.equal((await call('/learning',{action:'indexPdf',deckId:crypto.randomUUID(),fileId})).status,404);
 const indexed=await ok('/learning',{action:'indexPdf',deckId,fileId});assert.equal(indexed.pages,2);assert.equal(indexed.emptyPages,0);
 console.log('PASS: API e persistência — criação idempotente, retomada, conflito, origem e backup de aula.');
}finally{
 const current=await state(),deck=current.decks.find(d=>d.id===deckId);if(deck){assert.equal(deck.title,title);await ok('',{action:'deleteDeck',deckId});assert.equal((await call('/learning?id='+lessonId)).status,404);}
}
