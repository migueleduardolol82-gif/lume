import assert from 'node:assert/strict';
const base='http://127.0.0.1:5173/api/lume',prefix='QA subdecks '+crypto.randomUUID(),description='Fixture local temporária de hierarquia.';
const parentId=crypto.randomUUID(),childId=crypto.randomUUID(),grandchildId=crypto.randomUUID(),created=new Set();
async function state(){const r=await fetch(base,{redirect:'error'});assert.equal(r.status,200);const d=await r.json();assert.equal(d.name,'Prévia local');return d;}
async function post(body,path=''){const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),redirect:'error'});return {status:r.status,data:await r.json()};}
async function ok(body,path=''){const r=await post(body,path);assert.equal(r.status,200,r.data.error);return r.data;}
try{
 await state();
 for(const [id,title,parent]of [[parentId,'pai',undefined],[childId,'filho',parentId],[grandchildId,'neto',childId]]){await ok({action:'createDeck',id,title:prefix+' '+title,description,parentId:parent});created.add(id);}
 await ok({action:'saveCards',deckId:childId,cards:[{id:crypto.randomUUID(),front:'Cartão do filho',back:'Conteúdo preservado'}]});
 let d=await state();assert.equal(d.decks.find(x=>x.id===childId).parent_id,parentId);assert.equal(d.decks.find(x=>x.id===grandchildId).parent_id,childId);
 assert.equal((await post({action:'createDeck',id:crypto.randomUUID(),title:'missing',parentId:crypto.randomUUID()})).status,404);
 const self=crypto.randomUUID();assert.equal((await post({action:'createDeck',id:self,title:'self',parentId:self})).status,400);
 const backupResponse=await fetch(base+'/backup');assert.equal(backupResponse.status,200);const full=await backupResponse.json();
 const backup={...full,decks:full.decks.filter(x=>created.has(x.id)),reviews:full.reviews.filter(x=>created.has(x.deck_id)),messages:full.messages.filter(x=>created.has(x.deck_id))};
 assert.equal(backup.decks.find(x=>x.id===childId).parent_id,parentId);await ok(backup,'/backup');
 d=await state();const restored=d.decks.filter(x=>x.title.startsWith(prefix)&&!created.has(x.id));restored.forEach(x=>created.add(x.id));assert.equal(restored.length,3);
 const restoredParent=restored.find(x=>x.title===prefix+' pai'),restoredChild=restored.find(x=>x.title===prefix+' filho');assert.equal(restoredChild.parent_id,restoredParent.id);assert.equal(d.cards.filter(x=>x.deck_id===restoredChild.id).length,1);
 await ok({action:'deleteDeck',deckId:parentId});created.delete(parentId);d=await state();assert.equal(d.decks.find(x=>x.id===childId).parent_id,null);assert.equal(d.decks.find(x=>x.id===grandchildId).parent_id,childId);assert.equal(d.cards.filter(x=>x.deck_id===childId).length,1);
 console.log('PASS: subbaralhos aninhados, pais inválidos, backup/restore com novos IDs e exclusão do pai sem perda dos filhos.');
}finally{
 for(const id of [...created].reverse()){const d=await state(),deck=d.decks.find(x=>x.id===id);if(deck){assert.ok(deck.title.startsWith(prefix));assert.equal(deck.description,description);await ok({action:'deleteDeck',deckId:id});}}
 assert.equal((await state()).decks.some(x=>x.title.startsWith(prefix)),false);console.log('Fixtures de hierarquia removidas.');
}
