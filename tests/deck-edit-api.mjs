import assert from 'node:assert/strict';
const url='http://127.0.0.1:5173/api/lume',deckId=crypto.randomUUID(),cardId=crypto.randomUUID();
async function post(body){const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};}
try{
 let r=await post({action:'createDeck',id:deckId,title:'Teste de edição',description:'Antes',color:'violet'});assert.equal(r.status,200);
 r=await post({action:'saveCards',deckId,cards:[{id:cardId,front:'Pergunta',back:'Resposta'}]});assert.equal(r.status,200);
 r=await post({action:'review',deckId,cardId,eventId:crypto.randomUUID(),revision:0,rating:'good'});assert.equal(r.status,200);
 const original=r.data.cards.find(c=>c.id===cardId),reviews=r.data.reviews.filter(x=>x.card_id===cardId);
 r=await post({action:'editDeck',deckId,title:'  Nome revisado  ',description:'Depois',color:'green'});assert.equal(r.status,200);
 const deck=r.data.decks.find(d=>d.id===deckId);assert.equal(deck.title,'Nome revisado');assert.equal(deck.description,'Depois');assert.equal(deck.color,'green');
 assert.deepEqual(r.data.cards.find(c=>c.id===cardId),original);assert.deepEqual(r.data.reviews.filter(x=>x.card_id===cardId),reviews);
 for(const changes of [{title:' '},{color:'invalid'},{description:'x'.repeat(501)}]){const bad=await post({action:'editDeck',deckId,title:'Nome revisado',description:'Depois',color:'green',...changes});assert.equal(bad.status,400);}
 r=await post({action:'editDeck',deckId:crypto.randomUUID(),title:'Ausente',description:'',color:'blue'});assert.equal(r.status,404);
 const state=await (await fetch(url)).json();assert.equal(state.decks.find(d=>d.id===deckId).title,'Nome revisado');assert.deepEqual(state.cards.find(c=>c.id===cardId),original);
 console.log('PASS: edição persistida; cartão, prazo e histórico preservados; entradas inválidas e baralho ausente rejeitados.');
}finally{await post({action:'deleteDeck',deckId});}
