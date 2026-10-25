import {getOwner} from '../../../../lib/auth';
import {db} from '../../../../lib/database';
import {AppError} from '../../../../lib/ai';
import {readTicket,signTicket,type UploadTicket} from '../../../../lib/upload-ticket';
import {GENERATION_LIMITS as limits} from '../../../../lib/generation';
import {z} from 'zod';
export const dynamic='force-dynamic';
export const maxDuration=120;
const actions=z.discriminatedUnion('action',[
 z.object({action:z.literal('start'),deckId:z.string().min(1).max(100),name:z.string().min(1).max(200).regex(/\.pdf$/i),bytes:z.number().int().min(5).max(limits.pdfPartBytes)}),
 z.object({action:z.literal('complete'),deckId:z.string().min(1).max(100),ticket:z.string().max(3000),parts:z.array(z.string().max(3000)).min(1).max(Math.ceil(limits.pdfPartBytes/limits.chunkBytes))}),
 z.object({action:z.literal('cancel'),deckId:z.string().min(1).max(100),ticket:z.string().max(3000),kind:z.enum(['upload','file'])})
]);
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
async function context(request:Request){
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)throw new AppError('Origem inválida.',403);
 const owner=await getOwner();if(!owner)throw new AppError('Entre novamente para enviar o PDF.',401);
 if(!process.env.OPENAI_API_KEY)throw new AppError('A IA precisa da configuração segura no servidor.',503);return owner.userId;
}
async function ownDeck(owner:string,deckId:string){if(!await db.prepare('SELECT id FROM decks WHERE id=? AND owner=?').bind(deckId,owner).first())throw new AppError('Baralho não encontrado.',404);}
async function upstream(path:string,body?:object|FormData,method='POST'){
 const form=body instanceof FormData;
 const response=await fetch('https://api.openai.com/v1/'+path,{method,headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,...(!form?{'Content-Type':'application/json'}:{})},body:body?(form?body:JSON.stringify(body)):undefined,signal:AbortSignal.timeout(90000)});
 if(!response.ok){if(response.status===429)throw new AppError('Limite temporário de envio. Aguarde e tente novamente.',429);throw new AppError('Não foi possível processar o PDF. Tente enviá-lo novamente.',502);}return response.json();
}
function ticket(value:string,owner:string,deckId:string,kind:UploadTicket['kind']){try{return readTicket(value,owner,deckId,kind);}catch{throw new AppError('Envio inválido ou expirado. Selecione o PDF novamente.',400);}}
function handle(error:unknown){if(error instanceof AppError)return json({error:error.message},error.status);return json({error:'O envio do PDF falhou. Verifique a conexão e tente novamente.'},502);}
export async function POST(request:Request){try{
 const owner=await context(request),raw=await request.text();if(Buffer.byteLength(raw)>100000)throw new AppError('Solicitação muito grande.',413);
 let parsed:unknown;try{parsed=JSON.parse(raw);}catch{throw new AppError('Solicitação inválida.');}
 const valid=actions.safeParse(parsed);if(!valid.success)throw new AppError('Use uma parte de PDF de até 45 MB.');const a=valid.data;await ownDeck(owner,a.deckId);
 if(a.action==='start'){
  const upload=await upstream('uploads',{filename:a.name,bytes:a.bytes,mime_type:'application/pdf',purpose:'assistants',expires_after:{anchor:'created_at',seconds:3600}});
  return json({ticket:signTicket({kind:'upload',owner,deckId:a.deckId,id:upload.id,bytes:a.bytes,expires:Math.min(Date.now()+3500000,upload.expires_at*1000)}),chunkBytes:limits.chunkBytes});
 }
 if(a.action==='cancel'){
  const t=ticket(a.ticket,owner,a.deckId,a.kind);await upstream(a.kind==='file'?`files/${t.id}`:`uploads/${t.id}/cancel`,undefined,a.kind==='file'?'DELETE':'POST');return json({ok:true});
 }
 const t=ticket(a.ticket,owner,a.deckId,'upload'),parts=a.parts.map(v=>ticket(v,owner,a.deckId,'part'));
 if(parts.length!==Math.ceil(t.bytes/limits.chunkBytes)||parts.some((p,i)=>p.uploadId!==t.id||p.index!==i||p.bytes!==Math.min(limits.chunkBytes,t.bytes-i*limits.chunkBytes)))throw new AppError('O PDF está incompleto. Envie novamente.');
 const complete=await upstream(`uploads/${t.id}/complete`,{part_ids:parts.map(p=>p.id)});if(!complete.file?.id)throw new AppError('O PDF não ficou disponível.',502);
 return json({ticket:signTicket({kind:'file',owner,deckId:a.deckId,id:complete.file.id,bytes:t.bytes,expires:Math.min(Date.now()+3500000,(complete.file.expires_at??Date.now()/1000+3500)*1000)})});
}catch(error){return handle(error);}}
export async function PUT(request:Request){try{
 const owner=await context(request),deckId=request.headers.get('x-lume-deck')||'',value=request.headers.get('x-lume-upload')||'',index=Number(request.headers.get('x-lume-part'));
 const t=ticket(value,owner,deckId,'upload');await ownDeck(owner,deckId);
 if(!Number.isInteger(index)||index<0||index>=Math.ceil(t.bytes/limits.chunkBytes))throw new AppError('Parte inválida.');
 if(Number(request.headers.get('content-length'))>limits.chunkBytes)throw new AppError('Parte muito grande.',413);
 const data=await request.arrayBuffer();if(data.byteLength!==Math.min(limits.chunkBytes,t.bytes-index*limits.chunkBytes))throw new AppError('Parte incompleta.');
 if(index===0&&Buffer.from(data).subarray(0,5).toString()!=='%PDF-')throw new AppError('O arquivo não é um PDF válido.');
 const form=new FormData();form.append('data',new Blob([data]),'part.bin');const part=await upstream(`uploads/${t.id}/parts`,form);
 return json({ticket:signTicket({kind:'part',owner,deckId,id:part.id,uploadId:t.id,index,bytes:data.byteLength,expires:t.expires})});
}catch(error){return handle(error);}}
