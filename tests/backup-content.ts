import assert from 'node:assert/strict';
import test from 'node:test';
const {prepareRestore}=await import(new URL('../lib/backup.ts',import.meta.url).href) as typeof import('../lib/backup');
const details={origin:'Trecho de Física',sourceType:'text',evidence:'A água ferve a 100 °C a 1 atm.',evidenceStatus:'matched_text',hint:'Considere a pressão de 1 atm.',tags:['Física','Temperatura'],alternatives:['0 °C','50 °C','200 °C']};
const fixture=()=>({version:2,exportedAt:'2026-10-15',decks:[{id:'deck-old',title:'Física',description:'',color:'blue',source:'Fonte preservada',created:1000,cards:[{id:'card-old',front:'A que temperatura a água ferve a 1 atm?',back:'100 °C',due:5000,interval:3,repetitions:2,details:structuredClone(details)}]}],reviews:[],messages:[],materials:[{id:'note-old',deck_id:'deck-old',title:'Anotações',content:'Conteúdo atual',revision:2,created:1100,updated:3300,versions:[{revision:0,title:'Primeira versão',content:'Texto inicial',created:1100},{revision:1,title:'Revisada',content:'Texto revisado',created:2200}]}]});
type RestoredContent={cards:{id:string;deck_id:string;details?:unknown;due:number;interval:number;repetitions:number}[];decks:{id:string}[];materials:{id:string;deck_id:string;title:string;content:string;revision:number;created:number;updated:number;versions:{revision:number;title:string;content:string;created:number}[]}[];messages:{id:string;deck_id:string;references?:unknown}[]};
const restore=(input:unknown)=>{let i=0;return prepareRestore(input,()=>`restored-${++i}`) as unknown as RestoredContent;};

test('content backup restores provenance, evidence, hint, tags and alternatives without resetting study progress',()=>{
 const result=restore(fixture());
 assert.deepEqual(result.cards[0].details,details);
 assert.equal(result.cards[0].due,5000);assert.equal(result.cards[0].interval,3);assert.equal(result.cards[0].repetitions,2);
 assert.notEqual(result.cards[0].id,'card-old');assert.equal(result.cards[0].deck_id,result.decks[0].id);
});

test('release restore cannot import an unfinished card type through backup',()=>{
 const input=fixture();Object.assign(input.decks[0].cards[0].details,{template:{type:'image',fileId:'unvalidated-file',alt:'Descrição'}});
 assert.throws(()=>restore(input),/preparação/);
});

test('content backup restores material text, timestamps and revision history with remapped IDs',()=>{
 const input=fixture(),result=restore(input),material=result.materials[0];
 assert.equal(result.materials.length,1);assert.notEqual(material.id,'note-old');
 assert.equal(material.deck_id,result.decks[0].id);
 assert.deepEqual({...material,id:'note-old',deck_id:'deck-old'},input.materials[0]);
});

test('legacy version 2 backup without details or materials remains restorable',()=>{
 const input=fixture() as unknown as {materials?:unknown;decks:{cards:{details?:unknown}[]}[]};
 delete input.materials;delete input.decks[0].cards[0].details;
 const result=restore(input);
 assert.equal(result.cards.length,1);assert.deepEqual(result.materials,[]);
});

test('materials referencing an absent deck are rejected before restoration',()=>{
 const input=fixture();input.materials[0].deck_id='missing';
 assert.throws(()=>restore(input));
});

test('duplicate material identifiers are rejected instead of silently merging notes',()=>{
 const input=fixture();input.materials.push({...input.materials[0],content:'Conflicting note'});
 assert.throws(()=>restore(input));
});

test('a material can preserve 20 historical versions but cannot restore 21',()=>{
 const input=fixture();input.materials[0].revision=20;
 input.materials[0].versions=Array.from({length:20},(_,revision)=>({revision,title:'V'+revision,content:'Texto '+revision,created:1000+revision}));
 assert.equal(restore(input).materials[0].versions.length,20);
 input.materials[0].versions.push({revision:20,title:'V20',content:'Texto extra',created:1020});input.materials[0].revision=21;
 assert.throws(()=>restore(input));
});

test('invalid evidence status cannot enter a restored card as trusted provenance',()=>{
 const input=fixture();input.decks[0].cards[0].details.evidenceStatus='verified_by_human_without_review';
 assert.throws(()=>restore(input));
});

test('restoring metadata and notes does not mutate the imported JSON',()=>{
 const input=fixture(),before=structuredClone(input);
 restore(input);assert.deepEqual(input,before);
});

function linkedFixture(){const input=fixture();return {...input,decks:input.decks.map(deck=>({...deck,cards:deck.cards.map(card=>({...card,details:{...card.details,sourceType:'material',materialId:'note-old'}}))}))};}

test('card material links are remapped to the restored material instead of keeping old IDs',()=>{
 const result=restore(linkedFixture());
 const linked=result.cards[0].details as {materialId:string};
 assert.equal(linked.materialId,result.materials[0].id);assert.notEqual(linked.materialId,'note-old');
});

test('missing or cross-deck material links are rejected before restoration',()=>{
 const missing=linkedFixture();missing.materials=[];assert.throws(()=>restore(missing));
 const foreign=linkedFixture();foreign.decks.push({...foreign.decks[0],id:'other-deck',cards:[]});
 foreign.materials[0].deck_id='other-deck';assert.throws(()=>restore(foreign));
});

test('tutor reference snapshots preserve quoted content and historical IDs without remapping them',()=>{
 const references=[{id:'note-old:chunk-1',label:'Anotações · trecho 1',text:'Citação histórica.',kind:'note'},{id:'card-old',label:'Cartão de Física',text:'100 °C a 1 atm.',kind:'card'},{id:'source:archived',label:'Material original',text:'Fonte preservada.',kind:'source'}];
 const input={...fixture(),messages:[{deck_id:'deck-old',role:'assistant',content:'Resposta com referências.',created:4400,references}]};
 const result=restore(input);
 assert.equal(result.messages[0].deck_id,result.decks[0].id);
 assert.deepEqual(result.messages[0].references,references);
});

test('tutor reference snapshots reject unsupported kinds',()=>{
 const input={...fixture(),messages:[{deck_id:'deck-old',role:'assistant',content:'Resposta.',created:4400,references:[{id:'x',label:'Inválido',text:'Texto',kind:'execute_code'}]}]};
 assert.throws(()=>restore(input));
});
