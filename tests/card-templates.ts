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
 const pending=[{type:'multi_select',choices:[{text:'A',correct:true},{text:'B',correct:false}]},{type:'order',items:['A','B']},{type:'match',pairs:[{left:'A',right:'1'},{left:'B',right:'2'}]},{type:'image',fileId:'pending',alt:'Imagem'}];
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
