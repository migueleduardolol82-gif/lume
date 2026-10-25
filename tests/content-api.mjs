import assert from 'node:assert/strict';

const base='http://127.0.0.1:5173/api/lume';
const deckId=crypto.randomUUID(),cardId=crypto.randomUUID(),noteId=crypto.randomUUID();
const title='QA conteúdo '+deckId,description='Fixture temporária de metadados, notas e backup.';
const ownedDecks=new Set([deckId]);
const details={origin:'Material sintético de Física',sourceType:'text',evidence:'A água ferve a 100 °C a 1 atm.',evidenceStatus:'matched_text',hint:'Considere a pressão de 1 atm.',tags:['Física'],alternatives:['0 °C','50 °C','200 °C']};
const editedDetails={...details,evidenceStatus:'needs_review'};
async function call(path='',body){
 const response=await fetch(base+path,{method:body===undefined?'GET':'POST',redirect:'error',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(45000)});
 assert.match(response.headers.get('content-type')||'',/application\/json/,'A API deve responder JSON; verifique se a prévia compilou.');
 return {status:response.status,data:await response.json()};
}
async function state(){const result=await call();assert.equal(result.status,200);assert.equal(result.data.name,'Prévia local');return result.data;}
async function ok(path,body){const result=await call(path,body);assert.equal(result.status,200,result.data.error);return result.data;}
async function currentCard(){return (await state()).cards.find(c=>c.id===cardId);}
async function currentNote(){const data=await ok('/materials?deckId='+encodeURIComponent(deckId));assert.ok(Array.isArray(data.notes));const note=data.notes.find(n=>n.id===noteId);if(!note)return;const history=await ok('/materials?deckId='+encodeURIComponent(deckId)+'&id='+encodeURIComponent(noteId));return {...note,versions:history.versions};}
async function saveNote(note,changes={}){return call('/materials',{action:'saveNote',deckId,id:noteId,title:note.title,content:note.content,revision:note.revision,...changes});}

try{
 await state();
 await ok('',{action:'createDeck',id:deckId,title,description,color:'blue'});
 await ok('',{action:'saveCards',deckId,cards:[{id:cardId,front:'A que temperatura a água ferve a 1 atm?',back:'100 °C',details}]});
 let card=await currentCard();assert.deepEqual(card.details,details);
 await ok('',{action:'review',deckId,cardId,eventId:crypto.randomUUID(),revision:card.revision,rating:'good'});
 card=await currentCard();const progress={due:card.due,interval:card.interval,repetitions:card.repetitions};
 await ok('',{action:'editCard',deckId,revision:card.revision,card:{id:cardId,front:'Qual a temperatura de ebulição da água a 1 atm?',back:'100 °C'}});
 let edited=await currentCard();assert.deepEqual(edited.details,editedDetails);
 assert.deepEqual({due:edited.due,interval:edited.interval,repetitions:edited.repetitions},progress);
 assert.equal((await call('',{action:'editCard',deckId,revision:card.revision,card:{id:cardId,front:'Edição antiga',back:'Não salvar',details:{hint:'Antigo'}}})).status,409);
 assert.equal((await currentCard()).front,edited.front);
 assert.equal((await call('',{action:'editCard',deckId,revision:edited.revision,card:{id:cardId,front:edited.front,back:edited.back,details:{hint:'x'.repeat(501)}}})).status,400);
 console.log('PASS: metadados persistidos; edição legada preserva detalhes e progresso; conflito e limites rejeitados.');

 await ok('',{action:'saveSource',deckId,source:'Notas recentes de outro acesso.',expectedSource:''});
 const conflictingCard=crypto.randomUUID();
 assert.equal((await call('',{action:'saveCards',deckId,source:'Material antigo',cards:[{id:conflictingCard,front:'Não salvar parcialmente',back:'Rollback'}]})).status,409);
 let snapshot=await state();assert.equal(snapshot.cards.some(c=>c.id===conflictingCard),false);
 assert.equal(snapshot.decks.find(d=>d.id===deckId).source,'Notas recentes de outro acesso.');
 console.log('PASS: salvar cartões com material desatualizado não sobrescreve notas nem deixa lote parcial.');

 await ok('/materials',{action:'saveNote',deckId,id:noteId,title:'Nota original',content:'Conteúdo original',revision:0});
 let note=await currentNote();assert.ok(note);assert.equal(note.content,'Conteúdo original');
 const concurrent=await Promise.all([saveNote(note,{content:'Edição A'}),saveNote(note,{content:'Edição B'})]);
 assert.deepEqual(concurrent.map(r=>r.status).sort(),[200,409]);
 note=await currentNote();assert.equal(note.revision,1);assert.equal(note.versions.length,2);assert.equal(note.versions.find(v=>v.revision===0).content,'Conteúdo original');
 for(let i=0;i<21;i++){
  const result=await saveNote(note,{content:'Versão sintética '+i});assert.equal(result.status,200,result.data.error);
  note=await currentNote();
 }
 assert.equal(note.versions.length,20);assert.equal(new Set(note.versions.map(v=>v.revision)).size,20);
 assert.equal(note.content,'Versão sintética 20');
 console.log('PASS: notas persistidas; edição concorrente rejeitada; histórico limitado às 20 versões recentes.');

 const linkedCardId=crypto.randomUUID(),linkedDetails={...editedDetails,sourceType:'material',materialId:noteId};
 await ok('',{action:'saveCards',deckId,cards:[{id:linkedCardId,front:'Qual conceito aparece nesta nota?',back:'Conteúdo sintético da nota.',details:linkedDetails}]});
 assert.deepEqual((await state()).cards.find(c=>c.id===linkedCardId).details,linkedDetails);

 const backup=await ok('/backup');
 const savedDeck=backup.decks.find(d=>d.id===deckId);assert.ok(savedDeck);
 assert.deepEqual(savedDeck.cards.find(c=>c.id===cardId).details,editedDetails);
 const savedNote=backup.materials.find(n=>n.id===noteId);assert.ok(savedNote);assert.deepEqual(savedNote.versions,note.versions);
 const isolated={...backup,decks:[savedDeck],reviews:backup.reviews.filter(r=>r.deck_id===deckId),messages:backup.messages.filter(m=>m.deck_id===deckId),materials:[savedNote]};
 // Do not include other users' or other tests' file manifests in the fixture restore.
 if('files' in isolated)isolated.files=[];
 const before=new Set((await state()).decks.map(d=>d.id));
 await ok('/backup',isolated);
 snapshot=await state();
 const restored=snapshot.decks.filter(d=>!before.has(d.id)&&d.title===title&&d.description===description);
 for(const deck of restored)ownedDecks.add(deck.id);
 assert.equal(restored.length,1);
 const restoredCard=snapshot.cards.find(c=>c.deck_id===restored[0].id&&c.front===edited.front);assert.ok(restoredCard);
 assert.notEqual(restoredCard.id,cardId);assert.deepEqual(restoredCard.details,editedDetails);
 assert.deepEqual({due:restoredCard.due,interval:restoredCard.interval,repetitions:restoredCard.repetitions},progress);
 const restoredMaterials=await ok('/materials?deckId='+encodeURIComponent(restored[0].id));
 assert.equal(restoredMaterials.notes.length,1);assert.notEqual(restoredMaterials.notes[0].id,noteId);
 assert.equal(restoredMaterials.notes[0].content,note.content);
 const restoredHistory=await ok('/materials?deckId='+encodeURIComponent(restored[0].id)+'&id='+encodeURIComponent(restoredMaterials.notes[0].id));assert.deepEqual(restoredHistory.versions,note.versions);
 const restoredLinked=snapshot.cards.find(c=>c.deck_id===restored[0].id&&c.front==='Qual conceito aparece nesta nota?');assert.ok(restoredLinked);
 assert.equal(restoredLinked.details.materialId,restoredMaterials.notes[0].id);
 console.log('PASS: backup e restauração preservam detalhes, progresso, notas e histórico com novos IDs.');
 await ok('/materials',{action:'deleteNote',deckId,id:noteId,revision:note.revision});
 const detached=(await state()).cards.find(c=>c.id===linkedCardId);const {materialId:oldLink,...snapshotDetails}=linkedDetails;
 assert.equal(oldLink,noteId);assert.deepEqual(detached.details,snapshotDetails);assert.equal(detached.revision,1);
 console.log('PASS: exclusão de nota remove o vínculo do cartão e preserva a origem e o trecho histórico.');
}finally{
 const snapshot=await state();
 for(const id of ownedDecks){const deck=snapshot.decks.find(d=>d.id===id);if(!deck)continue;assert.equal(deck.title,title);assert.equal(deck.description,description);await ok('',{action:'deleteDeck',deckId:id});}
 const remaining=await state();assert.equal(remaining.decks.some(d=>ownedDecks.has(d.id)),false);assert.equal(remaining.cards.some(c=>ownedDecks.has(c.deck_id)),false);
 console.log('Fixtures de conteúdo identificadas por ID removidas.');
}
