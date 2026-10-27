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
