import assert from 'node:assert/strict';
const base='http://127.0.0.1:5173/api/lume',deckId=crypto.randomUUID();
async function call(path,body,method='POST',headers={}){const response=await fetch(base+path,{method,headers:{'Content-Type':method==='PUT'?'application/octet-stream':'application/json',...headers},body:method==='PUT'?body:JSON.stringify(body),signal:AbortSignal.timeout(140000)});const data=await response.json();return {status:response.status,data};}
function pdf(size){
 const content='BT /F1 14 Tf 50 750 Td (Active recall means remembering without consulting the material.) Tj 0 -25 Td (Spaced repetition distributes reviews over time.) Tj 0 -25 Td (Feedback helps identify mistakes and improve learning.) Tj ET';
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${content.length} >>\nstream\n${content}\nendstream`];
 let prefix='%PDF-1.4\n',offsets=[0];objects.forEach((o,i)=>{offsets.push(Buffer.byteLength(prefix));prefix+=`${i+1} 0 obj\n${o}\nendobj\n`;});
 const suffix=position=>'xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${position}\n%%EOF\n`;
 let padding=size-Buffer.byteLength(prefix)-Buffer.byteLength(suffix(size));for(let i=0;i<3;i++)padding=size-Buffer.byteLength(prefix)-Buffer.byteLength(suffix(Buffer.byteLength(prefix)+padding));
 const result=Buffer.concat([Buffer.from(prefix),Buffer.alloc(padding,32),Buffer.from(suffix(Buffer.byteLength(prefix)+padding))]);assert.equal(result.length,size);return result;
}
let pending,uploaded;
try{
 let result=await call('',{action:'createDeck',id:deckId,title:'Teste temporário PDF 45 MB',color:'blue'});assert.equal(result.status,200);
 result=await call('/uploads',{action:'start',deckId,name:'limite.pdf',bytes:45_000_001});assert.equal(result.status,400);
 result=await call('/uploads',{action:'start',deckId,name:'teste.pdf',bytes:45_000_000});assert.equal(result.status,200,result.data.error);pending=result.data.ticket;
 const invalid=await call('/uploads',{action:'complete',deckId,ticket:pending,parts:['invalid']});assert.equal(invalid.status,400);
 const data=pdf(45_000_000),parts=[];
 for(let offset=0;offset<data.length;offset+=2_000_000){result=await call('/uploads',data.subarray(offset,offset+2_000_000),'PUT',{'x-lume-deck':deckId,'x-lume-upload':pending,'x-lume-part':String(parts.length)});assert.equal(result.status,200,result.data.error);parts.push(result.data.ticket);if(parts.length%5===0)console.log(`PDF sintético: ${parts.length}/23 partes aceitas.`);}
 result=await call('/uploads',{action:'complete',deckId,ticket:pending,parts});assert.equal(result.status,200,result.data.error);uploaded=result.data.ticket;pending=undefined;
 console.log('PASS: PDF exato de 45 MB enviado e concluído; arquivo acima do limite e parte inválida rejeitados.');
 result=await call('',{action:'generate',deckId,text:'',count:3,total:300,offset:0,previous:[],fileTicket:uploaded});assert.equal(result.status,200,result.data.error);assert.equal(result.data.cards.length,3);
 console.log('PASS: geração real de 3 cartões com o PDF enviado, em uma coleção solicitada de até 300.');
 const cards=Array.from({length:300},(_,i)=>({id:crypto.randomUUID(),front:'Pergunta sintética '+i,back:'Resposta sintética '+i}));
 for(let repeat=0;repeat<2;repeat++){result=await call('',{action:'saveCards',deckId,cards});assert.equal(result.status,200);assert.equal(result.data.cards.filter(c=>c.deck_id===deckId).length,300);}
 console.log('PASS: 300 rascunhos salvos e reenvio do mesmo lote não duplica cartões.');
}finally{
 if(uploaded||pending){const cleanup=await call('/uploads',{action:'cancel',deckId,ticket:uploaded||pending,kind:uploaded?'file':'upload'});assert.equal(cleanup.status,200,'A remoção do arquivo sintético deve ser confirmada.');console.log('Arquivo sintético removido do provedor.');}
 const cleanup=await call('',{action:'deleteDeck',deckId});assert.equal(cleanup.status,200);console.log('Baralho temporário removido.');
}
