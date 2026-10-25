import test from 'node:test';
import assert from 'node:assert/strict';
const {evaluateWrittenAnswer,getQuizHint}=await import(new URL('../lib/quiz-feedback.ts',import.meta.url).href) as typeof import('../lib/quiz-feedback');
test('exact matches preserve scientific meaning and normalize only whitespace/NFC',()=>{
 assert.equal(evaluateWrittenAnswer('  energia\n química ','energia química').kind,'exact');
 for(const [answer,reference]of [['CO','Co'],['avó','avô'],['x²','x2'],['1,5','15'],['x-y','x+y']])assert.equal(evaluateWrittenAnswer(answer,reference).kind,'different');
 assert.equal(evaluateWrittenAnswer('','').kind,'different');
});
test('partial is a conservative suggestion requiring learner confirmation',()=>{
 const result=evaluateWrittenAnswer('energia luminosa em','energia luminosa em energia química');assert.equal(result.kind,'possible_partial');assert.equal(result.requiresConfirmation,true);
 assert.equal(evaluateWrittenAnswer('luminosa energia','energia luminosa em energia química').kind,'different');
 assert.equal(evaluateWrittenAnswer('energia','energia luminosa em energia química').kind,'different');
});

test('REG-QUIZ-NEG-001: omitted negative quantifiers never suggest a partial answer',()=>{
 for(const [answer,reference]of [['produz energia','tampouco produz energia'],['efeito é observado','nenhum efeito é observado'],['pode entrar','ninguém pode entrar'],['foi encontrado','nada foi encontrado']])assert.equal(evaluateWrittenAnswer(answer,reference).kind,'different');
});
test('negation, numerical, symbol and chemical conflicts never become partial',()=>{
 const pairs=[['tratam infecções virais','não tratam infecções virais'],['Antibióticos tratam infecções virais','Antibióticos não tratam infecções virais'],['A água ferve','A água ferve a 100 °C'],['a concentração é Co','a concentração é CO'],['A fórmula é x-y','A fórmula é x+y'],['existem plantas','não existem plantas'],['A massa é negativa','A massa é negativa e constante']];
 for(const [a,r]of pairs)assert.equal(evaluateWrittenAnswer(a,r).kind,'different',a+' / '+r);
});
test('only explicit authored hints are returned; no synthetic hint is fabricated',()=>{
 assert.equal(getQuizHint({}),null);assert.equal(getQuizHint({details:{hint:'  '}}),null);assert.equal(getQuizHint({details:{hint:'  Pense na organela.  '}}),'Pense na organela.');
});
