import assert from 'node:assert/strict';
import test from 'node:test';
const {schedule}=await import(new URL('../lib/study.ts',import.meta.url).href) as typeof import('../lib/study');
const day=86_400_000;

test('study progression: consecutive good reviews advance 1, 3 and 7 days',()=>{
 let progress={interval:0,repetitions:0,due:0};
 const now=1_700_000_000_000;
 for(const [index,days]of [1,3,7].entries()){
  progress=schedule(progress.interval,progress.repetitions,'good',now);
  assert.equal(progress.due,now+days*day);assert.equal(progress.repetitions,index+1);
 }
});

test('study progression: an error restarts learning after ten minutes and the next success uses one day',()=>{
 const now=1_700_000_000_000;
 const again=schedule(120,12,'again',now);
 assert.equal(again.due,now+600_000);assert.equal(again.repetitions,0);
 const next=schedule(again.interval,again.repetitions,'good',again.due);
 assert.equal(next.due,again.due+day);assert.equal(next.repetitions,1);
});

test('study progression: difficult/easy choices differ and long intervals are capped at a year',()=>{
 const now=1_700_000_000_000;
 assert.ok(schedule(10,3,'easy',now).due>schedule(10,3,'hard',now).due);
 for(const rating of ['hard','good','easy']as const){
  const next=schedule(365,30,rating,now);
  assert.equal(next.interval,365);assert.equal(next.due,now+365*day);
 }
});
