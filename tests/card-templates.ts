import test from 'node:test';
import assert from 'node:assert/strict';
const {cardDetailsSchema,releaseCardDetailsSchema}=await import(new URL('../lib/content.ts',import.meta.url).href);
test('templates persist through card metadata',()=>{const template={type:'true_false',correct:false};assert.deepEqual(cardDetailsSchema.parse({template}).template,template);});
test('release gate rejects unfinished templates on writes while retaining normal card metadata',()=>{
 assert.equal(releaseCardDetailsSchema.safeParse({template:{type:'image',fileId:'pending',alt:'Imagem'}}).success,false);
 assert.deepEqual(releaseCardDetailsSchema.parse({hint:'Dica',tags:['Tema']}),{hint:'Dica',tags:['Tema']});
});

test('true/false release preserves both boolean values and rejects malformed answers',()=>{
 for(const correct of [true,false])assert.deepEqual(releaseCardDetailsSchema.parse({template:{type:'true_false',correct}}).template,{type:'true_false',correct});
 for(const correct of ['false',0,null,undefined])assert.equal(releaseCardDetailsSchema.safeParse({template:{type:'true_false',correct}}).success,false);
});

test('release still rejects every other valid advanced template',()=>{
 const pending=[{type:'match',pairs:[{left:'A',right:'1'},{left:'B',right:'2'}]},{type:'image',fileId:'pending',alt:'Imagem'}];
 for(const template of pending){assert.equal(cardDetailsSchema.safeParse({template}).success,true);assert.equal(releaseCardDetailsSchema.safeParse({template}).success,false);}
});

const {cardTemplateSchema,evaluateTemplate,clozeParts,templateReference}=await import(new URL('../lib/card-templates.ts',import.meta.url).href) as typeof import('../lib/card-templates');
test('cloze release accepts one to eight blanks and preserves signed, accented answers',()=>{
 const template={type:'cloze' as const,text:'Íon {{Na⁺}} e carga {{-1}}.'};assert.deepEqual(releaseCardDetailsSchema.parse({template}).template,template);
 assert.equal(evaluateTemplate(template,[' Na⁺ ','-1']),true);assert.equal(evaluateTemplate(template,['Na⁺','1']),false);
 assert.equal(evaluateTemplate({type:'cloze',text:'{{ação}}'},['ac\u0327a\u0303o']),true);
 for(const amount of [1,8])assert.equal(cardTemplateSchema.safeParse({type:'cloze',text:Array.from({length:amount},(_,i)=>'{{'+i+'}}').join(' ')}).success,true);
 for(const text of ['Sem lacuna','{{ }}','{{a\nb}}','{{{a}}}','{{a}} texto {{','{{a}} texto }}',Array(9).fill('{{a}}').join(' ')])assert.equal(cardTemplateSchema.safeParse({type:'cloze',text}).success,false,text);
 assert.equal(templateReference(template),'Íon Na⁺ e carga -1.');assert.equal(clozeParts(template.text).filter(part=>part.answer!==undefined).length,2);
});

test('multi-select release accepts two to eight distinct options with a mixed answer key',()=>{
 const template={type:'multi_select' as const,choices:[{text:'-1',correct:true},{text:'1',correct:false},{text:'Na⁺',correct:true}]};assert.deepEqual(releaseCardDetailsSchema.parse({template}).template,template);
 assert.equal(evaluateTemplate(template,['2','0']),true);for(const answer of [[],['0'],['0','1','2'],['0','0','2'],['0','9']])assert.equal(evaluateTemplate(template,answer),false);
 assert.equal(templateReference(template),'-1\nNa⁺');
 for(const length of [2,8])assert.equal(cardTemplateSchema.safeParse({type:'multi_select',choices:Array.from({length},(_,i)=>({text:String(i),correct:i===0}))}).success,true);
});
test('REG-MULTI-ROUNDTRIP-001: multi-select rejects duplicate, multiline or unpersistable options',()=>{
 const valid={type:'multi_select',choices:[{text:'A',correct:true},{text:'B',correct:false}]};
 for(const choices of [[{text:'A',correct:true}],[{text:'A',correct:true},{text:'A',correct:false}],[{text:'ação',correct:true},{text:'ac\u0327a\u0303o',correct:false}],[{text:'A',correct:true},{text:'B',correct:true}],[{text:'A',correct:false},{text:'B',correct:false}],[{text:'A\nB',correct:true},{text:'C',correct:false}],[{text:'A\rB',correct:true},{text:'C',correct:false}],Array.from({length:9},(_,i)=>({text:String(i),correct:i===0})),Array.from({length:8},(_,i)=>({text:String(i).repeat(1000),correct:i<7}))])assert.equal(cardTemplateSchema.safeParse({...valid,choices}).success,false,JSON.stringify(choices).slice(0,150));
});

test('order release accepts two to eight distinct authored items and checks the exact permutation',()=>{
 const template={type:'order' as const,items:['-1','0','Na⁺']};assert.deepEqual(releaseCardDetailsSchema.parse({template}).template,template);assert.equal(evaluateTemplate(template,['0','1','2']),true);for(const answer of [[],['0','1'],['0','0','2'],['2','1','0'],[0,1,2],['0','1','9']])assert.equal(evaluateTemplate(template,answer),false);assert.equal(templateReference(template),'1. -1\n2. 0\n3. Na⁺');
 for(const amount of [2,8])assert.equal(cardTemplateSchema.safeParse({type:'order',items:Array.from({length:amount},(_,i)=>String(i))}).success,true);
});
test('REG-ORDER-ROUNDTRIP-001: order rejects multiline, duplicate and oversized authored keys',()=>{
 for(const items of [['A'],['A','A'],['ação','ac\u0327a\u0303o'],['A\nB','C'],['A\rB','C'],Array.from({length:9},(_,i)=>String(i)),Array.from({length:8},(_,i)=>String(i).repeat(1000))])assert.equal(cardTemplateSchema.safeParse({type:'order',items}).success,false);
});
