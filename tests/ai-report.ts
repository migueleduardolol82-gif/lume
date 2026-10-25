import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,rm} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
test('REG-QA-REPORT-001: live AI reports create their directory inside the project',async()=>{
 const {writeAiReport}=await import(new URL('../scripts/ai-report.mjs',import.meta.url).href);
 const name='regression-'+randomUUID()+'.json';
 const target=new URL('../.test-artifacts/reports/'+name,import.meta.url);
 try{
  await writeAiReport(name,{synthetic:true});
  assert.deepEqual(JSON.parse(await readFile(target,'utf8')),{synthetic:true});
  await assert.rejects(()=>writeAiReport('../outside.json',{}),/nome/i);
 }finally{await rm(target,{force:true});}
});

test('REG-QA-REPORT-002: tutor versioned filename is accepted and unsafe paths stay blocked',async()=>{
 const {writeAiReport}=await import(new URL('../scripts/ai-report.mjs',import.meta.url).href);
 const name='regression-v1.8-'+randomUUID()+'.json';
 const target=new URL('../.test-artifacts/reports/'+name,import.meta.url);
 try{
  await writeAiReport(name,{synthetic:true,version:'1.8'});
  assert.equal(JSON.parse(await readFile(target,'utf8')).version,'1.8');
  for(const invalid of ['../outside.json','..\\outside.json','/absolute.json','C:/absolute.json','bad%2fpath.json','.hidden.json','double..dot.json']){
   await assert.rejects(()=>writeAiReport(invalid,{}),/nome/i);
  }
 }finally{await rm(target,{force:true});}
});
