import assert from 'node:assert/strict';
import test from 'node:test';
const {CreationAttempt,completeReview}=await import(new URL('../lib/interaction.ts',import.meta.url).href) as typeof import('../lib/interaction');

test('late review completion preserves exit and a newly started session',async()=>{
 const old={index:0,cards:['a','b']},next={index:0,cards:['other']};
 assert.deepEqual(completeReview(old,old),{index:1,cards:['a','b']});
 assert.equal(completeReview(null,old),null);
 assert.equal(completeReview(next,old),next);
 const advanced=completeReview(old,old);assert.equal(completeReview(advanced,old),advanced);
 assert.equal(completeReview(next,old,true),next);
 assert.equal(completeReview(null,old,true),null);
 assert.equal(completeReview(old,old,true),null);
});
test('a retry keeps creation ID and content after the first response is lost',()=>{
 const attempt=new CreationAttempt(),input={action:'saveCards',deckId:'deck',cards:[{id:'stable',front:'Original',back:'Answer'}]};
 const first=attempt.prepare(input);input.cards[0].front='Edited while waiting';
 (first.cards as typeof input.cards)[0].back='External mutation';
 const retry=attempt.prepare({action:'saveCards',deckId:'deck',cards:[{id:'new',front:'Changed',back:'Changed'}]});
 assert.deepEqual(retry,{action:'saveCards',deckId:'deck',cards:[{id:'stable',front:'Original',back:'Answer'}]});
 attempt.clear();assert.deepEqual(attempt.prepare({id:'new'}),{id:'new'});
});
