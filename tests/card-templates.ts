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
 const pending=[{type:'multi_select',choices:[{text:'A',correct:true},{text:'B',correct:false}]},{type:'cloze',text:'Lacuna {{A}}'},{type:'order',items:['A','B']},{type:'match',pairs:[{left:'A',right:'1'},{left:'B',right:'2'}]},{type:'image',fileId:'pending',alt:'Imagem'}];
 for(const template of pending){assert.equal(cardDetailsSchema.safeParse({template}).success,true);assert.equal(releaseCardDetailsSchema.safeParse({template}).success,false);}
});
