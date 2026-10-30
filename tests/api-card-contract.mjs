import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {fixture,reset} from './support/api-card-fixture.mjs';
const stub=new URL('./support/api-card-fixture.mjs',import.meta.url).href;
const mocked=new Set(['database.mjs','auth.mjs','ai.mjs','upload-ticket.mjs']);
const hook=registerHooks({resolve(specifier,context,next){if(context.parentURL?.endsWith('/.test-artifacts/app/api/lume/route.mjs')&&mocked.has(specifier.split('/').at(-1)))return {url:stub,shortCircuit:true};return next(specifier,context);}});
const {POST}=await import('../.test-artifacts/app/api/lume/route.mjs');
hook.deregister();
const initialDatabase=process.env.DATABASE_URL;
process.env.DATABASE_URL='offline-fixture';
test.after(()=>{if(initialDatabase===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=initialDatabase;});
async function post(body,origin='http://localhost'){return POST(new Request('http://localhost/api/lume',{method:'POST',headers:{'Content-Type':'application/json',origin},body:JSON.stringify(body)}));}
const falseCard={id:'tf',front:'Afirmação sintética',back:'Falso',revision:2,details:{origin:'Fonte sintética',template:{type:'true_false',correct:false}}};

test('REG-TF-EDIT-002: metadata omitted in legacy edit cannot contradict the stored true/false key',async()=>{
 reset(falseCard);
 const result=await post({action:'editCard',deckId:'deck',revision:2,card:{id:'tf',front:falseCard.front,back:'Verdadeiro'}});
 assert.equal(result.status,400);assert.equal(fixture.writes.length,0);
});

test('legacy edit preserves true/false metadata when its answer is consistent',async()=>{
 reset(falseCard);
 const result=await post({action:'editCard',deckId:'deck',revision:2,card:{id:'tf',front:'Afirmação editada',back:'Falso'}});
 assert.equal(result.status,200);assert.equal(fixture.writes.length,1);
 assert.deepEqual(JSON.parse(fixture.writes[0].values[2]),falseCard.details);
});

test('REG-TF-IMPORT-002: legacy import passes boolean false to the database details column',async()=>{
 reset();
 const result=await post({action:'importBackup',decks:[{title:'Importação sintética',cards:[{front:falseCard.front,back:falseCard.back,details:falseCard.details}]}]});
 assert.equal(result.status,200);
 const insert=fixture.writes.find(write=>write.sql.startsWith('INSERT INTO cards'));
 assert.ok(insert);assert.match(insert.sql,/revision,details\)/);assert.match(insert.sql,/details jsonb/);
 const cards=JSON.parse(insert.values.at(-1));assert.deepEqual(cards[0].details,falseCard.details);
});

for(const card of [{...falseCard,back:'Verdadeiro'},{...falseCard,details:{template:{type:'true_false',correct:'false'}}},{...falseCard,details:{template:{type:'image',fileId:'pending',alt:'Imagem sintética'}}}])test('invalid or unfinished card rejected before any write: '+JSON.stringify(card.details),async()=>{
 reset();const result=await post({action:'saveCards',deckId:'deck',cards:[card]});assert.equal(result.status,400);assert.equal(fixture.writes.length,0);
});

test('true/false API rejects stale revision and foreign origin without changing the card',async()=>{
 reset(falseCard);assert.equal((await post({action:'editCard',deckId:'deck',revision:1,card:falseCard})).status,409);assert.equal(fixture.writes.length,0);
 assert.equal((await post({action:'saveCards',deckId:'deck',cards:[falseCard]},'https://external.example')).status,403);assert.equal(fixture.writes.length,0);
});

const clozeCard={id:'cloze',front:'Complete a carga',back:'Carga -1.',revision:2,details:{template:{type:'cloze',text:'Carga {{-1}}.'}}};
test('REG-CLOZE-API-001: contradicting or malformed blanks cannot be written, including edits without details',async()=>{
 for(const card of [{...clozeCard,back:'Carga 1.'},{...clozeCard,details:{template:{type:'cloze',text:'Carga {{{-1}}}.'}}}]){reset();assert.equal((await post({action:'saveCards',deckId:'deck',cards:[card]})).status,400);assert.equal(fixture.writes.length,0);}
 reset(clozeCard);assert.equal((await post({action:'editCard',deckId:'deck',revision:2,card:{id:'cloze',front:clozeCard.front,back:'Carga 1.'}})).status,400);assert.equal(fixture.writes.length,0);
});
test('cloze legacy import passes authored markup to the database',async()=>{
 reset();assert.equal((await post({action:'importBackup',decks:[{title:'Lacunas',cards:[clozeCard]}]})).status,200);const insert=fixture.writes.find(write=>write.sql.startsWith('INSERT INTO cards'));assert.deepEqual(JSON.parse(insert.values.at(-1))[0].details,clozeCard.details);
});

const multiCard={id:'multi',front:'Selecione as referências',back:'-1\nNa⁺',revision:2,details:{template:{type:'multi_select',choices:[{text:'-1',correct:true},{text:'1',correct:false},{text:'Na⁺',correct:true}]}}};
test('REG-MULTI-API-001: invalid key, duplicate options and legacy contradiction cannot be written',async()=>{
 for(const card of [{...multiCard,back:'1\nNa⁺'},{...multiCard,details:{template:{type:'multi_select',choices:[{text:'A',correct:true},{text:'A',correct:false}]}}}]){reset();assert.equal((await post({action:'saveCards',deckId:'deck',cards:[card]})).status,400);assert.equal(fixture.writes.length,0);}
 reset(multiCard);assert.equal((await post({action:'editCard',deckId:'deck',revision:2,card:{id:'multi',front:multiCard.front,back:'1\nNa⁺'}})).status,400);assert.equal(fixture.writes.length,0);
});
test('multi-select legacy import preserves every option and the mixed key',async()=>{
 reset();assert.equal((await post({action:'importBackup',decks:[{title:'Seleção',cards:[multiCard]}]})).status,200);const insert=fixture.writes.find(write=>write.sql.startsWith('INSERT INTO cards'));assert.deepEqual(JSON.parse(insert.values.at(-1))[0].details,multiCard.details);
});

const orderCard={id:'order',front:'Ordene',back:'1. A\n2. B',revision:2,details:{template:{type:'order',items:['A','B']}}};
test('REG-ORDER-API-001: conflicting key, duplicate items and legacy contradiction are rejected before writes',async()=>{
 for(const card of [{...orderCard,back:'1. B\n2. A'},{...orderCard,details:{template:{type:'order',items:['A','A']}}}]){reset();assert.equal((await post({action:'saveCards',deckId:'deck',cards:[card]})).status,400);assert.equal(fixture.writes.length,0);}reset(orderCard);assert.equal((await post({action:'editCard',deckId:'deck',revision:2,card:{id:'order',front:'Ordene',back:'1. B\n2. A'}})).status,400);assert.equal(fixture.writes.length,0);
});
test('legacy order import preserves the authored sequence',async()=>{
 reset();assert.equal((await post({action:'importBackup',decks:[{title:'Ordem',cards:[orderCard]}]})).status,200);const insert=fixture.writes.find(write=>write.sql.startsWith('INSERT INTO cards'));assert.deepEqual(JSON.parse(insert.values.at(-1))[0].details,orderCard.details);
});

const matchCard={id:'match',front:'Associe',back:'A → 1\nB → 2',revision:2,details:{template:{type:'match',pairs:[{left:'A',right:'1'},{left:'B',right:'2'}]}}};
test('REG-MATCH-API-001: contradictory back, repeated correspondence and legacy contradiction cannot be written',async()=>{
 for(const card of [{...matchCard,back:'A → 2\nB → 1'},{...matchCard,details:{template:{type:'match',pairs:[{left:'A',right:'1'},{left:'B',right:'1'}]}}}]){reset();assert.equal((await post({action:'saveCards',deckId:'deck',cards:[card]})).status,400);assert.equal(fixture.writes.length,0);}reset(matchCard);assert.equal((await post({action:'editCard',deckId:'deck',revision:2,card:{id:'match',front:'Associe',back:'A → 2\nB → 1'}})).status,400);assert.equal(fixture.writes.length,0);
});
test('legacy matching import preserves each authored correspondence',async()=>{
 reset();assert.equal((await post({action:'importBackup',decks:[{title:'Pares',cards:[matchCard]}]})).status,200);const insert=fixture.writes.find(write=>write.sql.startsWith('INSERT INTO cards'));assert.deepEqual(JSON.parse(insert.values.at(-1))[0].details,matchCard.details);
});
