import assert from 'node:assert/strict';
import test from 'node:test';
const {buildStudyPath,buildThematicStudyPath}=await import(new URL('../lib/study-path.ts',import.meta.url).href) as typeof import('../lib/study-path');
const now=1_700_000_000_000;
const cards=(count:number)=>Array.from({length:count},(_,i)=>({id:'card-'+i,front:'Pergunta '+i,back:'Resposta '+i,interval:i%3===0?1:0,due:now+(i%3-1)*1000}));

test('empty study path contains no artificial steps',()=>{
 assert.deepEqual(buildStudyPath([],now),[]);
});

test('one card creates one named step and a due boundary includes exactly now',()=>{
 const input=[{...cards(1)[0],due:now,interval:0}];
 const steps=buildStudyPath(input,now);
 assert.equal(steps.length,1);assert.equal(steps[0].id,input[0].id);
 assert.equal(steps[0].title,'Etapa 1');assert.deepEqual(steps[0].cards,input);
 assert.equal(steps[0].due,1);assert.equal(steps[0].reviewed,0);
});

test('25 cards occupy steps of 10, 10 and 5 with every card once and in source order',()=>{
 const input=cards(25),before=structuredClone(input);
 const steps=buildStudyPath(input,now);
 assert.deepEqual(steps.map(s=>s.cards.length),[10,10,5]);
 assert.deepEqual(steps.map(s=>s.title),['Etapa 1','Etapa 2','Etapa 3']);
 assert.deepEqual(steps.map(s=>s.id),['card-0','card-10','card-20']);
 assert.deepEqual(steps.flatMap(s=>s.cards),input);
 assert.equal(new Set(steps.flatMap(s=>s.cards.map(c=>c.id))).size,25);
 assert.deepEqual(input,before);
});

test('reviewed is interval-positive count, independent of whether a review is due',()=>{
 const input=[
  {...cards(1)[0],id:'future-reviewed',interval:1,due:now+1},
  {...cards(1)[0],id:'due-reviewed',interval:10,due:now},
  {...cards(1)[0],id:'due-new',interval:0,due:now-1},
  {...cards(1)[0],id:'future-new',interval:0,due:now+1},
 ];
 const steps=buildStudyPath(input,now,2);
 assert.deepEqual(steps.map(s=>s.reviewed),[2,0]);
 assert.deepEqual(steps.map(s=>s.due),[1,1]);
});

test('questions with mathematical symbols or identical text remain separate cards',()=>{
 const input=['2+2','2-2','2×2','2÷2','2+2'].map((front,i)=>({...cards(1)[0],id:'math-'+i,front}));
 const result=buildStudyPath(input,now,2).flatMap(s=>s.cards);
 assert.deepEqual(result,input);assert.equal(result.length,5);
});

test('duplicate identifiers are rejected instead of producing ambiguous step/card keys',()=>{
 const input=cards(12);input[11].id=input[0].id;
 assert.throws(()=>buildStudyPath(input,now));
});

test('step size must be a positive finite integer',()=>{
 for(const size of [0,-1,1.5,NaN,Infinity,-Infinity])assert.throws(()=>buildStudyPath(cards(1),now,size));
 assert.deepEqual(buildStudyPath(cards(3),now,1).map(s=>s.cards.length),[1,1,1]);
 assert.equal(buildStudyPath(cards(3),now,100).length,1);
});

test('building the path accepts frozen source data without sorting or mutating it',()=>{
 const input=cards(25);for(const card of input)Object.freeze(card);Object.freeze(input);
 assert.doesNotThrow(()=>buildStudyPath(input,now));
});

test('thematic path groups by first tag, retains every card exactly once and preserves order within a theme',()=>{
 const input=cards(6).map((card,index)=>({...card,details:{tags:[['Biologia','Física','Biologia','', 'Física','Química'][index],'Secundário']}}));
 const before=structuredClone(input),steps=buildThematicStudyPath(input,now,2);
 assert.deepEqual(steps.map(s=>s.theme),['Biologia','Física','Revisão geral','Química']);
 assert.deepEqual(steps.map(s=>s.cards.map(c=>c.id)),[['card-0','card-2'],['card-1','card-4'],['card-3'],['card-5']]);
 assert.deepEqual(input,before);assert.equal(steps.flatMap(s=>s.cards).length,6);
});

test('thematic path splits long themes into bounded stages and keeps legacy stage names without tags',()=>{
 const tagged=cards(21).map(card=>({...card,details:{tags:['Tema']}}));
 const steps=buildThematicStudyPath(tagged,now);
 assert.deepEqual(steps.map(s=>s.cards.length),[10,10,1]);assert.equal(steps[2].title,'Tema · Etapa 3');
 assert.deepEqual(buildThematicStudyPath(cards(25),now).map(s=>s.title),['Etapa 1','Etapa 2','Etapa 3']);
 assert.throws(()=>buildThematicStudyPath([tagged[0],tagged[0]],now));assert.throws(()=>buildThematicStudyPath([],now,0));
});
