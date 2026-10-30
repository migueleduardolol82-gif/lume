import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {fixture} from './support/image-file-fixture.mjs';
const stub=new URL('./support/image-file-fixture.mjs',import.meta.url).href;
const hook=registerHooks({resolve(specifier,context,next){if(context.parentURL?.endsWith('/app/api/lume/materials/files/route.mjs')&&/\/(database|auth|ai)\.mjs$/.test(specifier))return {url:stub,shortCircuit:true};return next(specifier,context);}});
const {GET,POST}=await import('../.test-artifacts/app/api/lume/materials/files/route.mjs');hook.deregister();
function reset(type='image/png'){fixture.owner='synthetic-owner';fixture.reads=0;fixture.card=null;fixture.writes=[];fixture.file={id:'image',owner:fixture.owner,deck_id:'deck',status:'ready',type,name:'Diagrama ç.png',bytes:fixture.bytes.length};}
const get=(query='id=image&view=inline')=>GET(new Request('http://localhost/api/lume/materials/files?'+query));
for(const type of ['image/png','image/jpeg','image/webp'])test('REG-IMAGE-INLINE-001: authenticated inline image uses its safe MIME: '+type,async()=>{
 reset(type);const r=await get();assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),type);assert.match(r.headers.get('content-disposition'),/^inline;/);assert.equal(r.headers.get('x-content-type-options'),'nosniff');assert.equal(r.headers.get('cache-control'),'private, no-store');assert.deepEqual(Buffer.from(await r.arrayBuffer()),fixture.bytes);
});
test('inline PDF and unsupported active formats are rejected',async()=>{
 for(const type of ['application/pdf','image/svg+xml','text/html']){reset(type);const r=await get();assert.equal(r.status,400);}
});
test('normal file download keeps attachment headers and original bytes',async()=>{
 reset('application/pdf');const r=await get('id=image');assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'application/octet-stream');assert.match(r.headers.get('content-disposition'),/^attachment;/);assert.deepEqual(Buffer.from(await r.arrayBuffer()),fixture.bytes);
});
test('missing login never queries image storage',async()=>{
 reset();fixture.owner=null;const r=await get();assert.equal(r.status,401);assert.equal(fixture.reads,0);
});
test('foreign, missing and unfinished images cannot be read inline',async()=>{
 for(const change of [{owner:'other-owner'},{status:'uploading'},{id:'removed'}]){reset();Object.assign(fixture.file,change);const r=await get();assert.equal(r.status,404);}
});
const remove=()=>POST(new Request('http://localhost/api/lume/materials/files',{method:'POST',headers:{origin:'http://localhost'},body:JSON.stringify({action:'delete',id:'image',deckId:'deck'})}));
test('REG-IMAGE-DELETE-001: image in use cannot be deleted leaving a broken card',async()=>{
 reset();fixture.card={id:'card',owner:fixture.owner,details:{template:{type:'image',fileId:'image'}}};
 const r=await remove();assert.equal(r.status,409);assert.match((await r.json()).error,/cartão/);assert.ok(fixture.file);assert.equal(fixture.writes.some(sql=>sql.startsWith('DELETE')),false);
});
test('image without references is removable, including after a card is unlinked',async()=>{
 reset();fixture.card={id:'card',owner:fixture.owner,details:{template:{type:'qa'}}};assert.equal((await remove()).status,200);assert.equal(fixture.file,null);
});
test('another owner or another file reference does not block deletion',async()=>{
 for(const card of [{owner:'other-owner',details:{template:{type:'image',fileId:'image'}}},{owner:'synthetic-owner',details:{template:{type:'image',fileId:'different'}}}]){reset();fixture.card=card;assert.equal((await remove()).status,200);}
});
