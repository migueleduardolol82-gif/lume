import assert from 'node:assert/strict';
const url='http://localhost:5173/api/lume',title='Backup verificado '+crypto.randomUUID(),now=Date.now();
const fixture={version:2,exportedAt:new Date().toISOString(),decks:[{id:'d',title,description:'Teste temporário',color:'green',source:'Referência preservada',created:now,cards:[{id:'c',front:'O que testar?',back:'Preservação do progresso',due:now+604800000,interval:7,repetitions:3}]}],reviews:[{deck_id:'d',card_id:'c',rating:'good',created:now}],messages:[{deck_id:'d',role:'user',content:'Explique o conceito.',created:now}]};
async function post(path,body){const r=await fetch(url+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};}
let did;
try{
 const restored=await post('/backup',fixture);assert.equal(restored.status,200,restored.data.error);assert.equal(restored.data.restored.cards,1);
 const state=await (await fetch(url)).json();did=state.decks.find(d=>d.title===title)?.id;assert.ok(did);const card=state.cards.find(c=>c.deck_id===did);assert.equal(card.due,fixture.decks[0].cards[0].due);assert.equal(card.interval,7);assert.ok(state.messages.some(m=>m.deck_id===did));
 const full=await fetch(url+'/backup');assert.equal(full.status,200);const exported=await full.json();assert.equal(exported.version,2);assert.ok(exported.decks.some(d=>d.id===did&&d.source==='Referência preservada'));assert.equal('owner' in exported.decks[0],false);
 const broken=structuredClone(fixture);broken.messages[0].deck_id='absent';const rejected=await post('/backup',broken);assert.equal(rejected.status,400);const again=await (await fetch(url)).json();assert.equal(again.decks.filter(d=>d.title===title).length,1);
 const hundred=Array.from({length:100},(_,i)=>({id:crypto.randomUUID(),front:'Pergunta '+i,back:'Resposta '+i}));const t=performance.now();const batch=await post('',{action:'saveCards',deckId:did,cards:hundred});assert.equal(batch.status,200,batch.data.error);assert.equal(batch.data.cards.filter(c=>c.deck_id===did).length,101);console.log('PASS: 100 cartões em lote, backup completo, progresso, conversas, referências inválidas e dados atuais preservados. Lote em',Math.round(performance.now()-t),'ms.');
}finally{if(did)await post('',{action:'deleteDeck',deckId:did});}
