import assert from 'node:assert/strict';
const base='http://127.0.0.1:5173/api/lume';
const deckId=crypto.randomUUID(),cardId=crypto.randomUUID();
const title='QA confiabilidade '+deckId,description='Fixture temporária de regressão; pode ser removida pelo próprio teste.';
async function state(){
 const response=await fetch(base,{redirect:'error',signal:AbortSignal.timeout(45000)});
 assert.equal(response.status,200);const data=await response.json();
 assert.equal(data.name,'Prévia local','Nenhuma escrita fora da identidade local de teste.');return data;
}
async function post(body,headers={}){
 const response=await fetch(base,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body),signal:AbortSignal.timeout(45000)});
 return {status:response.status,data:await response.json()};
}
async function ok(body){const result=await post(body);assert.equal(result.status,200,result.data.error);return result.data;}
let created=false;
try{
 await state();
 await ok({action:'createDeck',id:deckId,title,description,color:'blue'});created=true;
 await ok({action:'saveCards',deckId,cards:[{id:cardId,front:'Qual número resulta de 2 + 2?',back:'4'}]});
 await ok({action:'saveSource',deckId,source:'Notas persistentes para estudo.',expectedSource:''});
 assert.equal((await state()).decks.find(d=>d.id===deckId).source,'Notas persistentes para estudo.');
 assert.equal((await post({action:'saveSource',deckId,source:'Edição antiga',expectedSource:''})).status,409);
 assert.equal((await state()).decks.find(d=>d.id===deckId).source,'Notas persistentes para estudo.');
 assert.equal((await post({action:'saveSource',deckId,source:'x'.repeat(24001),expectedSource:'Notas persistentes para estudo.'})).status,400);
 console.log('PASS: notas persistidas, conflito sem perda de conteúdo e limite de tamanho.');
 const event={action:'review',deckId,cardId,eventId:crypto.randomUUID(),revision:0,rating:'good'};
 const duplicate=await Promise.all([post(event),post(event)]);
 assert.deepEqual(duplicate.map(x=>x.status),[200,200]);
 let data=await state();
 assert.equal(data.reviews.filter(r=>r.id===event.eventId).length,1);
 assert.equal(data.cards.find(c=>c.id===cardId).revision,1);
 const race=await Promise.all([post({...event,eventId:crypto.randomUUID(),revision:1,rating:'hard'}),post({...event,eventId:crypto.randomUUID(),revision:1,rating:'easy'})]);
 assert.deepEqual(race.map(x=>x.status).sort(),[200,409]);
 data=await state();assert.equal(data.cards.find(c=>c.id===cardId).revision,2);
 assert.equal(data.reviews.filter(r=>r.card_id===cardId).length,2);
 console.log('PASS: reenvio idempotente e conflito entre duas revisões simultâneas.');
 const rejected=await post({action:'deleteDeck',deckId},{Origin:'https://example.com'});assert.equal(rejected.status,403);
 await ok({action:'deleteCard',deckId,cardId});
 const stale=await post({...event,eventId:crypto.randomUUID(),revision:2});assert.equal(stale.status,404);
 const editRemoved=await post({action:'editCard',deckId,card:{id:cardId,front:'Não deve fingir que salvou',back:'Cartão removido'}});
 assert.equal(editRemoved.status,404,'REG-002: editar um cartão removido deve informar 404, nunca confirmar salvamento inexistente.');
 console.log('PASS: origem externa, revisão e edição de cartão removido rejeitadas.');
}finally{
 if(created){
  const data=await state(),deck=data.decks.find(d=>d.id===deckId);
  if(deck){assert.equal(deck.title,title);assert.equal(deck.description,description);await ok({action:'deleteDeck',deckId});}
  const after=await state();assert.equal(after.decks.some(d=>d.id===deckId),false);assert.equal(after.cards.some(c=>c.deck_id===deckId),false);assert.equal(after.reviews.some(r=>r.deck_id===deckId),false);
  console.log('Fixture de confiabilidade removida; nenhum dado externo ao teste foi alterado.');
 }
}
