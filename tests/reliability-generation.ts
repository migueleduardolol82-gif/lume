import assert from 'node:assert/strict';
import test from 'node:test';
const {appendUniqueCards}=await import(new URL('../lib/generation.ts',import.meta.url).href) as typeof import('../lib/generation');
test('same supported fact cannot be repeated just by rephrasing the question',()=>{
 const existing={id:'first',front:'Em que organela ocorre a fotossíntese?',back:'A fotossíntese ocorre nos cloroplastos.',evidence:'A fotossíntese ocorre nos cloroplastos.'};
 const rephrased={...existing,id:'second',front:'Onde acontece a fotossíntese?'};
 assert.deepEqual(appendUniqueCards([existing],[rephrased],20),[existing]);
});
test('different facts sharing a short answer are preserved when supporting quotes differ',()=>{
 const cards=[{id:'one',front:'First?',back:'não',evidence:'Primeiro fato: não'},{id:'two',front:'Second?',back:'não',evidence:'Segundo fato: não'}];
 assert.equal(appendUniqueCards([],cards,20).length,2);
});

test('REG-001: generation must retain questions with different mathematical operators',()=>{
 const questions=['Quanto é 2+2?','Quanto é 2-2?','Quanto é 2×2?','Quanto é 2÷2?'];
 const cards=questions.map((front,i)=>({id:String(i),front,back:String(i)}));
 assert.deepEqual(appendUniqueCards([],cards,20).map(c=>c.front),questions);
});

test('REG-001: decimal punctuation and exponent notation cannot collapse distinct questions',()=>{
 const questions=['Compare 1,5 e 2.','Compare 15 e 2.','Quanto vale x²?','Quanto vale x2?'];
 const cards=questions.map((front,i)=>({id:String(i),front,back:String(i)}));
 assert.equal(appendUniqueCards([],cards,20).length,4);
});

test('deduplication still removes repeated questions while preserving the first answer',()=>{
 const first={id:'first',front:'Qual é a capital da França?',back:'Paris'};
 const duplicate={id:'second',front:'  Qual é a capital da França?  ',back:'Resposta posterior'};
 assert.deepEqual(appendUniqueCards([first],[duplicate],20),[first]);
});
