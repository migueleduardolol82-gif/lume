import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const stub=new URL('./support/learning-fixture.mjs',import.meta.url).href;
const hook=registerHooks({resolve(specifier,context,next){
 if(specifier==='server-only')return {url:'data:text/javascript,export {}',shortCircuit:true};
 if(/\/.test-artifacts\/app\/api\/lume\/(learning|backup)\/route.mjs$/.test(context.parentURL||'')&&['database.mjs','auth.mjs','ai.mjs'].includes(specifier.split('/').at(-1)))return {url:stub,shortCircuit:true};
 return next(specifier,context);
}});
const {pg,db,fixture}=await import('./support/learning-fixture.mjs');
const {GET,POST}=await import('../.test-artifacts/app/api/lume/learning/route.mjs');
const backup=await import('../.test-artifacts/app/api/lume/backup/route.mjs');
hook.deregister();
test.before(async()=>{
 for(const file of (await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await pg.exec(await readFile(new URL('../migrations/'+file,import.meta.url),'utf8'));
 await pg.query("INSERT INTO decks(id,owner,title,source,created) VALUES ('d','local-test','Fixture','',0),('foreign','another-owner','Outro espaço','',0)");
 await pg.query("INSERT INTO cards(id,owner,deck_id,front,back,due) VALUES ('c','local-test','d','Carga?','-1 mA',0)");
});
test.after(()=>pg.close());
const post=async body=>{const response=await POST(new Request('http://localhost/api/lume/learning',{method:'POST',headers:{origin:'http://localhost'},body:JSON.stringify(body)}));return {status:response.status,data:await response.json()};};
test('lesson API persists resume, rejects stale/foreign writes and restores snapshots through backup',async()=>{
 let result=await post({action:'create',id:'lesson',deckId:'d',kind:'lesson',title:'Aula sintética'});assert.equal(result.status,200,JSON.stringify(result.data));
 await pg.query("UPDATE cards SET back='Editado' WHERE id='c'");
 const body={action:'advance',id:'lesson',revision:0,index:0,eventId:'step',answer:'-1 mA',rating:'good'};
 assert.equal((await post(body)).status,200);assert.equal((await post(body)).status,200);
 result=await post({...body,eventId:'other'});assert.equal(result.status,409);
 const resumed=await (await GET(new Request('http://localhost/api/lume/learning?id=lesson'))).json();assert.equal(resumed.session.payload.index,1);assert.equal(resumed.session.payload.steps[0].back,'-1 mA');
 fixture.owner='another-owner';assert.equal((await post(body)).status,404);fixture.owner='local-test';
 const exported=await backup.GET();assert.equal(exported.status,200);const data=await exported.json();assert.equal(data.learning.length,1);
 const restored=await backup.POST(new Request('http://localhost/api/lume/backup',{method:'POST',headers:{origin:'http://localhost'},body:JSON.stringify(data)}));assert.equal(restored.status,200,await restored.text());
 const rows=await db.prepare("SELECT * FROM learning_sessions WHERE owner=? AND id<>?").bind('local-test','lesson').all();assert.equal(rows.results.length,1);assert.equal(rows.results[0].payload.index,1);assert.notEqual(rows.results[0].deck_id,'d');
});
test('indexed PDF enters actual Tutor retrieval with page labels; foreign files and fabricated citations are rejected',async()=>{
 const {PDFDocument}=await import('../lib/vendor/pdf-lib.mjs');const pdf=await PDFDocument.create();pdf.addPage().drawText('A corrente no circuito e -1 mA.');const bytes=await pdf.save();
 const hash=createHash('sha256').update(bytes).digest('hex');await pg.query("INSERT INTO material_files(id,owner,deck_id,name,type,bytes,status,sha256,created) VALUES ('pdf','local-test','d','Circuito.pdf','application/pdf',$1,'ready',$2,0)",[bytes.length,hash]);
 await pg.query('INSERT INTO material_file_chunks(file_id,part,bytes,sha256,data) VALUES ($1,0,$2,$3,$4)',['pdf',bytes.length,hash,Buffer.from(bytes)]);
 assert.equal((await post({action:'indexPdf',deckId:'foreign',fileId:'pdf'})).status,404);
 const indexed=await post({action:'indexPdf',deckId:'d',fileId:'pdf'});assert.equal(indexed.status,200,JSON.stringify(indexed.data));assert.equal(indexed.data.pages,1);
 const {buildTutorContext}=await import('../.test-artifacts/lib/tutor-context.mjs'),{tutorMaterials}=await import('../.test-artifacts/lib/tutor-materials.mjs');
 const excerpts=buildTutorContext({question:'corrente circuito',deckTitle:'Fixture',source:'',notes:await tutorMaterials(db,'local-test','d'),cards:[]});assert.match(excerpts[0].label,/Circuito.pdf · página 1/);assert.match(excerpts[0].text,/-1 mA/);
 await post({action:'create',id:'invalid-chat',deckId:'d',kind:'chat',title:'Citação inválida'});fixture.invalidCitation=true;
 assert.equal((await post({action:'message',id:'invalid-chat',eventId:'invalid',revision:0,question:'corrente circuito'})).status,502);fixture.invalidCitation=false;
 const saved=await (await GET(new Request('http://localhost/api/lume/learning?id=invalid-chat'))).json();assert.equal(saved.session.payload.messages.length,0);
});
test('REG-CHAT-RETRY-001: repeating a confirmed question returns saved result without another model call',async()=>{
 await pg.query("INSERT INTO materials(id,owner,deck_id,title,content,created,updated) VALUES ('retry-note','local-test','d','Circuito sintético','A corrente no circuito é -1 mA.',0,0)");
 await post({action:'create',id:'chat',deckId:'d',kind:'chat',title:'Conversa sintética'});
 const body={action:'message',id:'chat',eventId:'question',revision:0,question:'corrente circuito'};
 const before=fixture.aiCalls;assert.equal((await post(body)).status,200);const calls=fixture.aiCalls;assert.equal(calls,before+1);
 assert.equal((await post(body)).status,200);assert.equal(fixture.aiCalls,calls);
});
