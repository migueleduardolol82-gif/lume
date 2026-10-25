import test from 'node:test';
import assert from 'node:assert/strict';
const {cardDetailsSchema,releaseCardDetailsSchema}=await import(new URL('../lib/content.ts',import.meta.url).href);
test('templates persist through card metadata',()=>{const template={type:'true_false',correct:false};assert.deepEqual(cardDetailsSchema.parse({template}).template,template);});
test('release gate rejects unfinished templates on writes while retaining normal card metadata',()=>{
 assert.equal(releaseCardDetailsSchema.safeParse({template:{type:'true_false',correct:true}}).success,false);
 assert.deepEqual(releaseCardDetailsSchema.parse({hint:'Dica',tags:['Tema']}),{hint:'Dica',tags:['Tema']});
});
