import assert from 'node:assert/strict';
import {writeAiReport} from '../scripts/ai-report.mjs';
const base='http://127.0.0.1:5173/api/lume',deckId=crypto.randomUUID(),noteId=crypto.randomUUID(),title='QA tutor '+deckId;
async function call(path='',body){const r=await fetch(base+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(135000)});const d=await r.json();assert.equal(r.status,200,d.error);return d;}
async function state(){const d=await call();assert.equal(d.name,'Prévia local');return d;}
let created=false;
try{
 await state();await call('',{action:'createDeck',id:deckId,title,color:'green'});created=true;
 const absent=await call('',{action:'tutor',deckId,question:'Qual é a temperatura de ebulição da água?'});assert.match(absent.answer,/Não encontrei trechos pertinentes/);assert.deepEqual(absent.references,[]);
 const content='A água pura ferve a aproximadamente 100 °C à pressão de 1 atm. Essa temperatura depende da pressão. Antibióticos não tratam infecções virais.';
 await call('/materials',{action:'saveNote',deckId,id:noteId,title:'Referência científica sintética',content,revision:0});
 const response=await call('',{action:'tutor',deckId,question:'Qual a temperatura de ebulição da água pura a 1 atm segundo a nota?'});
 assert.match(response.answer,/100/);assert.ok(response.references.length>0,'Resposta factual deve citar a nota fornecida.');
 for(const ref of response.references){assert.equal(ref.kind,'note');assert.ok(ref.id.startsWith('note:'+noteId+':'));assert.ok(content.includes(ref.text));}
 const reload=await state(),message=reload.messages.filter(m=>m.deck_id===deckId&&m.role==='assistant').at(-1);assert.deepEqual(message.references_data,response.references);
 const followup=await call('',{action:'tutor',deckId,question:'Me explique de outro jeito'});assert.ok(followup.references.some(ref=>ref.id.startsWith('note:'+noteId+':')),'REG-TUTOR-001: continuação deve recuperar o material do assunto anterior.');assert.doesNotMatch(followup.answer,/Não encontrei trechos pertinentes/);
 const backup=await call('/backup'),saved=backup.messages.find(m=>m.deck_id===deckId&&m.role==='assistant'&&m.content===message.content);assert.ok(saved);assert.deepEqual(saved.references,response.references);
 await writeAiReport('lume-v1.8-tutor-avaliacao.json',{question:'Temperatura da água a 1 atm',source:content,answer:response.answer,references:response.references,checked:['fato numérico','citações válidas','persistência','backup','ausência de fonte'],limitation:'Amostra sintética; não comprova correção universal.'});
 console.log('PASS: tutor real recupera nota, responde fato numérico, preserva citações no estado e backup; ausência de fonte não inventa resposta.');
}finally{if(created){const d=(await state()).decks.find(d=>d.id===deckId);assert.equal(d?.title,title);await call('',{action:'deleteDeck',deckId});console.log('Fixture do tutor removida por ID confirmado.');}}
