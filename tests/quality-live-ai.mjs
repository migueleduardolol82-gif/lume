import assert from 'node:assert/strict';
import {writeAiReport} from '../scripts/ai-report.mjs';
const base='http://127.0.0.1:5173/api/lume',deckId=crypto.randomUUID();
const title='QA IA qualidade '+deckId;
async function state(){const response=await fetch(base,{redirect:'error'});assert.equal(response.status,200);const data=await response.json();assert.equal(data.name,'Prévia local');return data;}
async function post(body){const response=await fetch(base,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(135000)});const data=await response.json();assert.equal(response.status,200,data.error);return data;}
let created=false;
try{
 await state();await post({action:'createDeck',id:deckId,title,color:'green'});created=true;
 const source='A água pura ferve a aproximadamente 100 °C à pressão de 1 atm. Antibióticos não tratam infecções virais. A fotossíntese ocorre nos cloroplastos.';
 const generated=await post({action:'generate',deckId,text:source,count:3});
 assert.ok(generated.cards.length>0&&generated.cards.length<=3);
 for(const card of generated.cards){assert.ok(source.includes(card.evidence));assert.ok(card.evidence.includes(card.back));assert.equal(card.evidenceStatus,'matched_text');}
 const empty=await post({action:'generate',deckId,text:'Este documento está vazio de conteúdo de estudo. Não há fatos para extrair.',count:3});
 assert.equal(empty.cards.length,0,'Fonte sem fatos não deve produzir cartões para completar a quantidade.');
 assert.equal(empty.insufficient,true);
 await writeAiReport('lume-avaliacao-ia.json',{source,generated,insufficient:empty,limits:'Citação presente não comprova correção semântica; amostra requer revisão humana.'});
 console.log('PASS: geração real com trechos presentes na fonte e zero cartões para fonte insuficiente.');
}finally{
 if(created){const deck=(await state()).decks.find(d=>d.id===deckId);assert.equal(deck?.title,title);await post({action:'deleteDeck',deckId});}
}
