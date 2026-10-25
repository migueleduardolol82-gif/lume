import test from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument} from '../lib/vendor/pdf-lib.mjs';
const {splitPdfForAi,generatePdfCards}=await import(new URL('../lib/pdf-generation.ts',import.meta.url).href) as typeof import('../lib/pdf-generation');

test('PDF splitting preserves all pages in order and keeps each output below the configured bound',async()=>{
 const source=await PDFDocument.create();for(let i=0;i<8;i++){const page=source.addPage([200+i,200]);page.drawText('Página '+i,{x:10,y:100});}
 const bytes=await source.save({useObjectStreams:false}),file=new File([new Uint8Array(bytes)],'original.pdf',{type:'application/pdf'});
 const widths:number[]=[],parts=[];
 for await(const part of splitPdfForAi(file,{maxPartBytes:1400})){assert.ok(part.file.size<=1400);const doc=await PDFDocument.load(await part.file.arrayBuffer());widths.push(...doc.getPages().map(page=>page.getWidth()));parts.push(part);}
 assert.ok(parts.length>1);assert.deepEqual(widths,[200,201,202,203,204,205,206,207]);assert.equal(parts[0].firstPage,1);assert.equal(parts.at(-1)!.lastPage,8);
});

test('oversized single PDF page fails explicitly instead of uploading an unsupported file',async()=>{
 const doc=await PDFDocument.create();doc.addPage();const file=new File([new Uint8Array(await doc.save())],'large-page.pdf',{type:'application/pdf'});
 await assert.rejects(async()=>{for await(const _part of splitPdfForAi(file,{maxPartBytes:100})){}},/página.*limite/i);
});

test('input above 100 MB fails before reading the file',async()=>{
 const fake={size:100_000_001,name:'too-large.pdf',arrayBuffer:async()=>{throw Error('Must not read');}};
 await assert.rejects(async()=>{for await(const _part of splitPdfForAi(fake)){}},/100 MB/);
});

test('multipart generation skips empty sections, keeps drafts, bounds batches and cleans each uploaded part',async()=>{
 const parts=[1,2,3].map(n=>({file:new Blob(['pdf']),name:'part-'+n,firstPage:n,lastPage:n,totalPages:3}));
 const cleaned:string[]=[],seen:number[]=[],visible:number[]=[];
 const cards=await generatePdfCards({target:3,initial:[],stopped:()=>false,parts:(async function*(){yield* parts;})(),onCards:rows=>visible.push(rows.length),upload:async part=>part.name,cleanup:async ticket=>{cleaned.push(ticket);},generate:async(ticket,count,previous)=>{seen.push(count);if(ticket==='part-1')return [];return Array.from({length:count},(_,i)=>({id:ticket+i,front:ticket+' questão '+i,back:'Referência '+previous.length+i}));}});
 assert.equal(cards.length,3);assert.deepEqual(cleaned,['part-1','part-2','part-3']);assert.ok(seen.every(n=>n>=1&&n<=20));assert.equal(visible.at(-1),3);
});

test('failed AI batch preserves previous drafts and still cleans its uploaded PDF part',async()=>{
 let visible:unknown[]=[];const cleaned:string[]=[];let calls=0;
 const parts=(async function*(){yield {file:new Blob(['pdf']),name:'p',firstPage:1,lastPage:1,totalPages:1};})();
 await assert.rejects(generatePdfCards({target:21,initial:[],parts,stopped:()=>false,onCards:rows=>{visible=rows;},upload:async()=> 'ticket',cleanup:async ticket=>{cleaned.push(ticket);},generate:async()=>{if(++calls===2)throw Error('Falha sintética');return Array.from({length:20},(_,i)=>({id:String(i),front:'Questão '+i,back:'Resposta '+i}));}}),/Falha sintética/);
 assert.equal(visible.length,20);assert.deepEqual(cleaned,['ticket']);
});
