import assert from 'node:assert/strict';
const base='http://127.0.0.1:5173/api/lume',deckId=crypto.randomUUID(),cardId=crypto.randomUUID(),otherId=crypto.randomUUID(),title='QA verdadeiro falso '+crypto.randomUUID(),restoredTitle=title+' restaurado',legacyTitle=title+' legado';
let created=false;
async function call(path='',body){const response=await fetch(base+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(30000)});return {status:response.status,data:await response.json()};}
async function state(){const result=await call();assert.equal(result.status,200);assert.equal(result.data.name,'Prévia local','Nenhuma escrita fora da prévia local.');return result.data;}
async function ok(path,body){const result=await call(path,body);assert.equal(result.status,200,result.data.error);return result.data;}
try{
 await state();created=true;await ok('',{action:'createDeck',id:deckId,title,color:'green'});
 await ok('',{action:'saveCards',deckId,cards:[cardId,otherId].map(id=>({id,front:'Afirmação sintética falsa '+id,back:'Falso',details:{origin:'Material sintético',template:{type:'true_false',correct:false}}}))});
 let card=(await state()).cards.find(card=>card.id===cardId);assert.equal(card.details.template.correct,false);
 await ok('',{action:'review',deckId,cardId,eventId:crypto.randomUUID(),revision:card.revision,rating:'good'});
 card=(await state()).cards.find(card=>card.id===cardId);const progress={due:card.due,interval:card.interval,repetitions:card.repetitions};
 const edited={id:cardId,front:'Afirmação sintética verdadeira',back:'Verdadeiro',details:{origin:'Material sintético',template:{type:'true_false',correct:true}}};
 await ok('',{action:'editCard',deckId,revision:card.revision,card:edited});
 let current=(await state()).cards.find(card=>card.id===cardId);assert.equal(current.details.template.correct,true);for(const key of Object.keys(progress))assert.equal(current[key],progress[key]);
 assert.equal((await call('',{action:'editCard',deckId,revision:card.revision,card:edited})).status,409);
 for(const broken of [{...edited,back:'Falso'},{...edited,details:{template:{type:'true_false',correct:'false'}}},{...edited,details:{template:{type:'image',fileId:'pending',alt:'Imagem sintética'}}}])assert.equal((await call('',{action:'editCard',deckId,revision:current.revision,card:broken})).status,400);
 assert.equal((await call('',{action:'editCard',deckId,revision:current.revision,card:{id:cardId,front:current.front,back:'Falso'}})).status,400);
 await ok('',{action:'importBackup',decks:[{title:legacyTitle,cards:[{front:'Afirmação legada sintética',back:'Falso',details:{template:{type:'true_false',correct:false}}}]}]});
 const legacy=await state(),legacyDeck=legacy.decks.find(deck=>deck.title===legacyTitle);assert.ok(legacyDeck);assert.equal(legacy.cards.find(card=>card.deck_id===legacyDeck.id).details.template.correct,false);
 const full=await ok('/backup');
 const original=full.decks.find(deck=>deck.id===deckId);assert.equal(original.title,title);
 const fixture={version:2,exportedAt:new Date().toISOString(),decks:[{...original,title:restoredTitle}],reviews:full.reviews.filter(review=>review.deck_id===deckId),messages:[],materials:[]};
 await ok('/backup',fixture);
 const restored=(await state()).decks.find(deck=>deck.title===restoredTitle);assert.ok(restored);assert.notEqual(restored.id,deckId);
 const restoredCards=(await state()).cards.filter(card=>card.deck_id===restored.id);assert.equal(restoredCards.length,2);assert.deepEqual(restoredCards.map(card=>card.details.template.correct).sort(),[false,true]);
 console.log('PASS: verdadeiro/falso persistido, edição preserva revisão/progresso, conflitos e gabaritos inválidos rejeitados; backup/restauração preserva false e true.');
}finally{
 if(created){const data=await state();for(const deck of data.decks.filter(deck=>(deck.id===deckId&&deck.title===title)||deck.title===restoredTitle||deck.title===legacyTitle)){await state();await ok('',{action:'deleteDeck',deckId:deck.id});}console.log('Fixtures de verdadeiro/falso removidas por identidade, título exclusivo e IDs confirmados.');}
}
