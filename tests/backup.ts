import assert from 'node:assert/strict';
import test from 'node:test';
const {prepareRestore}=await import(new URL('../lib/backup.ts',import.meta.url).href) as typeof import('../lib/backup');
const fixture=()=>({version:2,exportedAt:'2026-10-13',decks:[{id:'deck',title:'Biologia',description:'',color:'green',source:'Material original',created:1000,cards:[{id:'card',front:'Pergunta',back:'Resposta',due:900000,interval:7,repetitions:3}]}],reviews:[{deck_id:'deck',card_id:'card',rating:'good',created:2000}],messages:[{deck_id:'deck',role:'user',content:'Explique',created:3000}]});
test('restoration preserves study data and remaps all current references',()=>{let i=0;const r=prepareRestore(fixture(),()=>String(++i));assert.equal(r.decks[0].id,'1');assert.equal(r.cards[0].id,'2');assert.equal(r.cards[0].deck_id,'1');assert.equal(r.reviews[0].card_id,'2');assert.equal(r.messages[0].deck_id,'1');assert.equal(r.cards[0].due,900000);assert.equal(r.cards[0].interval,7);assert.equal(r.decks[0].source,'Material original');});
test('historical review of a removed card remains in the history',()=>{const f=fixture();f.reviews[0].card_id='removed';const r=prepareRestore(f);assert.equal(r.reviews.length,1);assert.notEqual(r.reviews[0].card_id,'removed');});
test('foreign or repeated references are rejected before any write',()=>{const f=fixture();f.decks.push({...f.decks[0]});assert.throws(()=>prepareRestore(f),/baralho repetidos/);const g=fixture();g.messages[0].deck_id='absent';assert.throws(()=>prepareRestore(g),/baralho ausente/);const h=fixture();h.decks[0].cards.push({...h.decks[0].cards[0]});assert.throws(()=>prepareRestore(h),/cartão repetidos/);});
test('invalid progress and owner fields cannot override restored data',()=>{const f=fixture();f.decks[0].cards[0].interval=-1;assert.throws(()=>prepareRestore(f));const g={...fixture(),owner:'other-user'};const r=prepareRestore(g);assert.equal('owner' in r,false);assert.equal('owner' in r.decks[0],false);});
test('subdeck parent references are remapped together with the restored decks',()=>{
 const f=fixture();const input={...f,decks:[...f.decks,{...f.decks[0],id:'child',parent_id:'deck',cards:[]}]};
 const r=prepareRestore(input);assert.equal(r.decks[0].parent_id,null);assert.equal(r.decks[1].parent_id,r.decks[0].id);assert.notEqual(r.decks[1].parent_id,'deck');
});
test('missing parents and hierarchy cycles reject the entire restore',()=>{
 const f=fixture(),parent=f.decks[0];
 assert.throws(()=>prepareRestore({...f,decks:[{...parent,parent_id:'missing'}]}),/pai ausente/);
 assert.throws(()=>prepareRestore({...f,decks:[{...parent,parent_id:'child'},{...parent,id:'child',parent_id:'deck',cards:[]}]}),/ciclo/);
 assert.throws(()=>prepareRestore({...f,decks:[{...parent,parent_id:'deck'}]}),/ciclo/);
});
