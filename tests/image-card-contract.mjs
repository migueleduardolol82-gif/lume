import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {fixture,reset} from './support/api-card-fixture.mjs';
// Enable the image schema in this isolated test process, not the application.
// Authentication/storage use synthetic fixtures; validation and route are real.
const stub=new URL('./support/api-card-fixture.mjs',import.meta.url).href;
const hook=registerHooks({resolve(specifier,context,next){
 if(context.parentURL?.endsWith('/app/api/lume/route.mjs')&&/\/(database|auth|ai|upload-ticket)\.mjs$/.test(specifier))return {url:stub,shortCircuit:true};
 if(context.parentURL?.endsWith('/lib/content.mjs')&&specifier.endsWith('/release-features.mjs'))return {url:stub,shortCircuit:true};
 return next(specifier,context);
}});
const {POST}=await import('../.test-artifacts/app/api/lume/route.mjs');hook.deregister();
const initialDatabase=process.env.DATABASE_URL;process.env.DATABASE_URL='offline-fixture';
test.after(()=>{if(initialDatabase===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=initialDatabase;});
const card={id:'image-card',front:'Identifique a estrutura',back:'Estrutura sintética',details:{template:{type:'image',fileId:'image-file',alt:'Diagrama sintético'}}};
const file={id:'image-file',owner:'synthetic-owner',deck_id:'deck',type:'image/png',status:'ready'};
const post=body=>POST(new Request('http://localhost/api/lume',{method:'POST',headers:{origin:'http://localhost'},body:JSON.stringify(body)}));
for(const invalid of [null,{...file,owner:'other-owner'},{...file,deck_id:'other-deck'},{...file,status:'uploading'},{...file,type:'application/pdf'}])test('image creation rejects unavailable or invalid file before batch writes: '+JSON.stringify(invalid),async()=>{
 reset();fixture.file=invalid;const r=await post({action:'saveCards',deckId:'deck',cards:[card]});assert.equal(r.status,400);assert.equal(fixture.writes.length,0);
});
for(const type of ['image/png','image/jpeg','image/webp'])test('image creation preserves an owned ready image: '+type,async()=>{
 reset();fixture.file={...file,type};const r=await post({action:'saveCards',deckId:'deck',cards:[card]});assert.equal(r.status,200);const insert=fixture.writes.find(w=>w.sql.startsWith('INSERT INTO cards'));assert.deepEqual(JSON.parse(insert.values.at(-1))[0].details,card.details);
});
test('invalid image in a mixed batch prevents all card and source writes',async()=>{
 reset();const r=await post({action:'saveCards',deckId:'deck',source:'Fonte sintética',cards:[{id:'qa',front:'Pergunta',back:'Resposta'},card]});assert.equal(r.status,400);assert.equal(fixture.writes.length,0);
});
