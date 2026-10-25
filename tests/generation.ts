import assert from 'node:assert/strict';
import test from 'node:test';
const {generateBatches,GENERATION_LIMITS}=await import(new URL('../lib/generation.ts',import.meta.url).href) as typeof import('../lib/generation');
const {signTicket,readTicket}=await import(new URL('../lib/upload-ticket.ts',import.meta.url).href) as typeof import('../lib/upload-ticket');
type Card={id:string;front:string;back:string};
test('insufficient source stops after one empty batch without paid retries',async()=>{
 let calls=0;
 await assert.rejects(generateBatches({target:300,initial:[],stopped:()=>false,onCards:()=>{},load:async()=>{calls++;return [];}}),/conteúdo suficiente/);
 assert.equal(calls,1);
});
const make=(start:number,count:number)=>Array.from({length:count},(_,i)=>({id:String(start+i),front:'Pergunta '+(start+i),back:'Resposta '+(start+i)}));
test('REG-GENERATE-SHORT-001: exhausted source returns useful drafts instead of failing a partially completed generation',async()=>{
 let calls=0;
 const cards=await generateBatches({target:20,initial:[],stopped:()=>false,onCards:()=>{},load:async()=>++calls===1?make(0,3):[]});
 assert.equal(cards.length,3);assert.equal(calls,2);
});
test('300 cards arrive in fifteen bounded batches, with earlier questions carried forward',async()=>{
 let calls=0,visible:Card[]=[];
 const all=await generateBatches({target:300,initial:[],stopped:()=>false,onCards:c=>{visible=c;},load:async(count,previous)=>{assert.equal(count,20);assert.equal(previous.length,calls*20);calls++;return make(previous.length,count);}});
 assert.equal(calls,15);assert.equal(all.length,300);assert.deepEqual(visible,all);
});
test('failed batch preserves prior drafts and resume begins at remaining count',async()=>{
 let visible:Card[]=[];
 await assert.rejects(generateBatches({target:21,initial:[],stopped:()=>false,onCards:c=>{visible=c;},load:async(count,previous)=>{if(previous.length)throw Error('Connection lost');return make(0,count);}}),/Connection lost/);
 assert.equal(visible.length,20);
 const resumed=await generateBatches({target:21,initial:visible,stopped:()=>false,onCards:()=>{},load:async(count,previous)=>{assert.equal(count,1);return make(previous.length,count);}});assert.equal(resumed.length,21);
});
test('stop preserves last completed batch, duplicate-only output stops boundedly',async()=>{
 let stop=false;const paused=await generateBatches({target:300,initial:[],stopped:()=>stop,onCards:()=>{stop=true;},load:async count=>make(0,count)});assert.equal(paused.length,20);
 let calls=0;await assert.rejects(generateBatches({target:30,initial:make(0,20),stopped:()=>false,onCards:()=>{},load:async()=>{calls++;return make(0,10);}}),/não trouxe/);assert.equal(calls,2);
});
test('upload tickets reject tampering, wrong owner/deck/kind, and expiry; PDF input is 100 MB while signed AI parts are bounded to 45 MB',()=>{
 const old=process.env.OPENAI_API_KEY;process.env.OPENAI_API_KEY='synthetic-test-key';
 try{const t={kind:'file' as const,owner:'a',deckId:'d',id:'file_test',bytes:GENERATION_LIMITS.pdfPartBytes,expires:Date.now()+10000},signed=signTicket(t);assert.equal(readTicket(signed,'a','d','file').bytes,45_000_000);
 assert.throws(()=>readTicket(signed,'b','d','file'));assert.throws(()=>readTicket(signed,'a','other','file'));assert.throws(()=>readTicket(signed,'a','d','upload'));assert.throws(()=>readTicket(signed+'broken','a','d','file'));assert.throws(()=>readTicket(signTicket({...t,expires:1}),'a','d','file'));assert.throws(()=>signTicket({...t,bytes:45_000_001}));
 }finally{if(old===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=old;}
});
