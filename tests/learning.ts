import test from 'node:test';
import assert from 'node:assert/strict';
import {newLesson,advanceLesson} from '../lib/learning.ts';
test('lesson progress survives serialization, retry is idempotent, stale steps cannot skip ahead',()=>{
 const original=newLesson([{front:'Carga?',back:'-1'},{front:'Unidade?',back:'mA'}]);
 const saved=advanceLesson(original,{index:0,eventId:'first',answer:'-1',rating:'good'});
 const resumed=JSON.parse(JSON.stringify(saved));
 assert.equal(resumed.index,1);assert.equal(resumed.steps[1].back,'mA');
 assert.deepEqual(advanceLesson(resumed,{index:0,eventId:'first',answer:'-1',rating:'good'}),resumed);
 assert.throws(()=>advanceLesson(resumed,{index:0,eventId:'other',answer:'-1',rating:'good'}),/mudou/);
 assert.throws(()=>advanceLesson(resumed,{index:1,eventId:'next',answer:' ',rating:'good'}),/resposta/);
 assert.equal(original.index,0);
});
