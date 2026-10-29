import test from 'node:test';
import assert from 'node:assert/strict';
const {buildChoiceQuestions,canBuildChoiceQuiz}=await import(new URL('../lib/choice-quiz.ts',import.meta.url).href) as typeof import('../lib/choice-quiz');
const cards=Array.from({length:6},(_,i)=>({id:String(i),front:'Pergunta '+i,back:'Resposta '+i}));
test('reference occurs once alongside three distinct distractors',()=>{const result=buildChoiceQuestions(cards,()=>0.25);for(const [i,q]of result.entries()){assert.equal(q.cardId,cards[i].id);assert.equal(q.options.length,4);assert.equal(q.options.filter(o=>o.id===q.correctId).length,1);assert.equal(q.options.find(o=>o.id===q.correctId)?.text,cards[i].back);assert.equal(new Set(q.options.map(o=>o.text)).size,4);}});
test('duplicate answers are excluded and small decks use two choices',()=>{const result=buildChoiceQuestions([{id:'a',front:'A',back:'Paris'},{id:'b',front:'B',back:'  Paris  '},{id:'c',front:'C',back:'Londres'}],()=>0);assert.ok(result.every(q=>q.options.length===2));assert.equal(result[1].correctId,'b');});
test('scientific case and superscripts remain distinct choices',()=>{
 for(const answers of [['CO','Co'],['x²','x2']]){
  const questions=buildChoiceQuestions(answers.map((back,i)=>({id:String(i),front:'Pergunta '+i,back})));
  assert.equal(questions[0].options.length,2);
 }
});
test('empty and single-answer decks cannot start',()=>{assert.throws(()=>buildChoiceQuestions([]),/duas respostas/);assert.throws(()=>buildChoiceQuestions([{id:'a',front:'A',back:'Apenas uma'}]),/duas respostas/);});
test('shuffle preserves source and mathematical punctuation',()=>{const input=[{id:'a',front:'A',back:'x-y'},{id:'b',front:'B',back:'xy'}];const before=JSON.stringify(input);const result=buildChoiceQuestions(input,()=>0);assert.equal(JSON.stringify(input),before);assert.equal(result[0].options.length,2);assert.equal(result[0].options[0].text,'xy');});
test('custom alternatives work for one card and remove duplicates and correct answers',()=>{
 const input=[{id:'a',front:'Capital?',back:'Paris',details:{alternatives:['Paris',' Londres ','Londres','','Roma','Madri','Lisboa']}}];
 const before=JSON.stringify(input),[q]=buildChoiceQuestions(input,()=>0);
 assert.equal(q.source,'custom');assert.equal(q.options.length,4);assert.equal(q.options.filter(o=>o.text==='Paris').length,1);assert.equal(new Set(q.options.map(o=>o.text)).size,4);assert.equal(canBuildChoiceQuiz(input),true);assert.equal(JSON.stringify(input),before);
 assert.equal(canBuildChoiceQuiz([{id:'x',front:'Q',back:'A',details:{alternatives:['A',' ']}}]),false);
});
test('related alternatives prefer shared tags and disclose deck fallback when insufficient',()=>{
 const related=[{id:'a',front:'Q',back:'A',details:{tags:['Biologia']}},{id:'b',front:'Q',back:'B',details:{tags:[' biologia ']}},{id:'c',front:'Q',back:'C',details:{tags:['Biologia']}},{id:'d',front:'Q',back:'D',details:{tags:['Biologia']}},{id:'e',front:'Q',back:'E',details:{tags:['História']}}];
 const [q]=buildChoiceQuestions(related,()=>0);assert.equal(q.source,'related');assert.ok(q.options.every(o=>o.text!=='E'));assert.match(q.reviewNote!,/Revise/);
 const mixed=buildChoiceQuestions([related[0],related[1],related[4]],()=>0)[0];assert.equal(mixed.source,'deck');assert.match(mixed.reviewNote!,/faltaram/);assert.ok(mixed.options.some(o=>o.text==='B'));
});
test('eligibility uses deterministic validation without sampling Math.random',()=>{
 const original=Math.random;Math.random=()=>{throw Error('unexpected randomness');};try{assert.equal(canBuildChoiceQuiz(cards),true);assert.equal(canBuildChoiceQuiz([]),false);}finally{Math.random=original;}
});
test('duplicate answer in another topic does not erase a related alternative',()=>{
 const questions=buildChoiceQuestions([{id:'a',front:'Q',back:'A',details:{tags:['bio']}},{id:'b',front:'Q',back:'B',details:{tags:['bio']}},{id:'c',front:'Q',back:'B',details:{tags:['história']}}]);
 assert.equal(questions[0].source,'related');assert.equal(questions[0].options.length,2);
});

test('true/false cards build two authored options without unrelated distractors',()=>{
 const cards=[{id:'false-card',front:'Afirmação sintética',back:'Falso',details:{template:{type:'true_false',correct:false}}}];
 const result=buildChoiceQuestions(cards,()=>0);
 assert.equal(result.length,1);assert.equal(result[0].cardId,'false-card');
 assert.deepEqual(new Set(result[0].options.map(option=>option.text)),new Set(['Verdadeiro','Falso']));
 assert.equal(result[0].options.find(option=>option.id===result[0].correctId)?.text,'Falso');
});

test('REG-TF-CHOICE-001: boolean keys cannot become distractors for unrelated ordinary questions',()=>{
 const mixed=[{id:'tf',front:'Afirmação',back:'Falso',details:{template:{type:'true_false',correct:false}}},{id:'a',front:'Cidade A',back:'Paris'},{id:'b',front:'Cidade B',back:'Londres'}];
 const questions=buildChoiceQuestions(mixed,()=>0);
 assert.deepEqual(questions.map(question=>question.cardId),['tf','a','b']);
 assert.deepEqual(new Set(questions[1].options.map(option=>option.text)),new Set(['Paris','Londres']));
});

test('REG-CLOZE-CHOICE-001: cloze-only quiz starts without exposing answers as ordinary distractors',()=>{
 const cloze={id:'c',front:'Complete',back:'Carga -1.',details:{template:{type:'cloze'}}};
 assert.equal(canBuildChoiceQuiz([cloze]),true);
 const mixed=buildChoiceQuestions([cloze,{id:'a',front:'Cidade A',back:'Paris'},{id:'b',front:'Cidade B',back:'Londres'}],()=>0);
 assert.deepEqual(mixed.map(question=>question.cardId),['c','a','b']);assert.deepEqual(mixed[0].options,[]);
 assert.deepEqual(new Set(mixed[1].options.map(option=>option.text)),new Set(['Paris','Londres']));
});

test('multi-select-only quiz starts and authored keys never become ordinary distractors',()=>{
 const multi={id:'m',front:'Selecione',back:'A\nC',details:{template:{type:'multi_select'}}};assert.equal(canBuildChoiceQuiz([multi]),true);const result=buildChoiceQuestions([multi,{id:'q1',front:'Q1',back:'Paris'},{id:'q2',front:'Q2',back:'Londres'}]);assert.deepEqual(result.map(question=>question.cardId),['m','q1','q2']);assert.deepEqual(result[0].options,[]);assert.deepEqual(new Set(result[1].options.map(option=>option.text)),new Set(['Paris','Londres']));
});
