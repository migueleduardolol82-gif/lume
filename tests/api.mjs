import assert from 'node:assert/strict';
const base='http://localhost:5173/api/lume',id=crypto.randomUUID(),cid=crypto.randomUUID();
async function call(a){const r=await fetch(base,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(a)});return {status:r.status,data:await r.json()};}
async function ok(a){const r=await call(a);assert.equal(r.status,200,r.data.error);return r.data;}
try{
 await ok({action:'createDeck',id,title:'Verificação temporária',color:'blue'});
 await ok({action:'saveCards',deckId:id,cards:[{id:cid,front:'Qual é a soma de dois e dois?',back:'Quatro.'}]});
 const eventId=crypto.randomUUID();const a={action:'review',deckId:id,cardId:cid,eventId,revision:0,rating:'good'};
 const dup=await Promise.all([call(a),call(a)]);assert.deepEqual(dup.map(x=>x.status),[200,200]);
 let state=await (await fetch(base)).json();assert.equal(state.reviews.filter(r=>r.id===eventId).length,1);assert.equal(state.cards.find(c=>c.id===cid).revision,1);
 const race=await Promise.all([call({...a,eventId:crypto.randomUUID(),revision:1,rating:'hard'}),call({...a,eventId:crypto.randomUUID(),revision:1,rating:'easy'})]);assert.deepEqual(race.map(x=>x.status).sort(),[200,409]);
 await ok({action:'editCard',deckId:id,card:{id:cid,front:'Pergunta editada',back:'Resposta editada'}});
 state=await (await fetch(base)).json();assert.equal(state.cards.find(c=>c.id===cid).front,'Pergunta editada');
 const ai=await ok({action:'generate',deckId:id,text:'A fotossíntese converte energia luminosa em energia química. Ocorre nos cloroplastos. Consome água e dióxido de carbono e produz glicose e oxigênio.',count:3});assert.equal(ai.cards.length,3);
 const tutor=await ok({action:'tutor',deckId:id,question:'Explique a soma de dois e dois em uma frase.'});assert.ok(tutor.answer.length>0);assert.ok(tutor.messages.some(m=>m.deck_id===id));
 const forbidden=await fetch(base,{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://example.com'},body:JSON.stringify({action:'deleteDeck',deckId:id})});assert.equal(forbidden.status,403);
 console.log('PASS: CRUD, persistência, duplicata simultânea, conflito concorrente, geração IA, tutor/histórico e origem protegida.');
}finally{await ok({action:'deleteDeck',deckId:id});console.log('Dados temporários de teste removidos.');}
