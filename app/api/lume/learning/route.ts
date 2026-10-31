import {z} from 'zod';
import {createHash} from 'node:crypto';
import {db} from '../../../../lib/database';
import {getOwner} from '../../../../lib/auth';
import {ai,AppError} from '../../../../lib/ai';
import {advanceLesson,learningPayloadSchema,newLesson,type LearningSession} from '../../../../lib/learning';
import {extractPdfText} from '../../../../lib/pdf-text';
import {tutorMaterials} from '../../../../lib/tutor-materials';
import {buildTutorContext,buildTutorPrompt} from '../../../../lib/tutor-context';
export const dynamic='force-dynamic';
export const maxDuration=120;
const id=z.string().min(1).max(100);
const actions=z.discriminatedUnion('action',[
 z.object({action:z.literal('create'),id,deckId:id,kind:z.enum(['lesson','chat']),title:z.string().trim().min(1).max(120)}),
 z.object({action:z.literal('advance'),id,eventId:id,revision:z.number().int().nonnegative(),index:z.number().int().nonnegative(),answer:z.string().trim().min(1).max(6000),rating:z.enum(['again','good'])}),
 z.object({action:z.literal('message'),id,eventId:id,revision:z.number().int().nonnegative(),question:z.string().trim().min(1).max(2000)}),
 z.object({action:z.literal('indexPdf'),deckId:id,fileId:id}),
]);
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
async function owner(){const user=await getOwner();if(!user)throw new AppError('Entre para acessar seus estudos.',401);return user.userId;}
function fail(e:unknown){if(e instanceof AppError)return json({error:e.message},e.status);if(e instanceof z.ZodError||e instanceof SyntaxError)return json({error:'Dados inválidos.'},400);console.error('lume_learning_failed',e instanceof Error?e.name:'unknown');return json({error:'Não foi possível concluir. Seu progresso salvo foi mantido.'},500);}
async function session(id:string,owner:string){const row=await db.prepare('SELECT * FROM learning_sessions WHERE id=? AND owner=?').bind(id,owner).first<LearningSession>();if(!row)throw new AppError('Aula ou conversa não encontrada.',404);row.payload=learningPayloadSchema.parse(row.payload);return row;}
export async function GET(request:Request){try{
 const user=await owner(),url=new URL(request.url),selected=url.searchParams.get('id');
 if(selected)return json({session:await session(id.parse(selected),user)});
 const rows=await db.prepare("SELECT id,deck_id,kind,title,revision,created,updated,COALESCE((payload->>'index')::integer,0) AS progress,jsonb_array_length(COALESCE(payload->'steps','[]'::jsonb)) AS total FROM learning_sessions WHERE owner=? ORDER BY updated DESC,id DESC LIMIT 50").bind(user).all();
 return json({sessions:rows.results,limit:50});
 }catch(e){return fail(e);}}
export async function POST(request:Request){try{
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)throw new AppError('Origem inválida.',403);
 const user=await owner(),raw=await request.text();if(Buffer.byteLength(raw)>16000)throw new AppError('Envio muito grande.',413);
 const a=actions.parse(JSON.parse(raw)),now=Date.now();
 if(a.action==='create'){
  const deck=await db.prepare('SELECT title FROM decks WHERE id=? AND owner=?').bind(a.deckId,user).first<{title:string}>();if(!deck)throw new AppError('Baralho não encontrado.',404);
  const existing=await db.prepare('SELECT * FROM learning_sessions WHERE id=? AND owner=?').bind(a.id,user).first<LearningSession>();
  if(existing){if(existing.deck_id!==a.deckId||existing.kind!==a.kind)throw new AppError('Identificador já usado em outro estudo.',409);return json({session:existing});}
  const cards=await db.prepare('SELECT front,back FROM cards WHERE deck_id=? AND owner=? ORDER BY id LIMIT 50').bind(a.deckId,user).all<{front:string;back:string}>();
  if(a.kind==='lesson'&&!cards.results.length)throw new AppError('Adicione cartões antes de criar uma aula.');
  const payload=a.kind==='lesson'?newLesson(cards.results):learningPayloadSchema.parse({});
  const saved=await db.prepare('INSERT INTO learning_sessions(id,owner,deck_id,kind,title,payload,created,updated) SELECT ?,?,?,?,?,?::jsonb,?,? FROM decks WHERE id=? AND owner=? ON CONFLICT DO NOTHING').bind(a.id,user,a.deckId,a.kind,a.title,JSON.stringify(payload),now,now,a.deckId,user).run();
  if(!saved.meta.changes)throw new AppError('O estudo mudou durante a criação. Tente novamente.',409);
  return json({session:await session(a.id,user)});
 }
 if(a.action==='indexPdf'){
  const file=await db.prepare("SELECT id,name,type,bytes,sha256 FROM material_files WHERE id=? AND deck_id=? AND owner=? AND status='ready'").bind(a.fileId,a.deckId,user).first<{id:string;name:string;type:string;bytes:number;sha256:string}>();
  if(!file)throw new AppError('Arquivo não encontrado.',404);if(file.type!=='application/pdf')throw new AppError('Prepare um PDF com texto; para imagens, adicione uma transcrição nas notas.');
  if(file.bytes>30_000_000)throw new AppError('Divida PDFs maiores que 30 MB antes de preparar o Tutor.',413);
  const chunks=await db.prepare('SELECT c.part,c.data FROM material_file_chunks c JOIN material_files f ON f.id=c.file_id WHERE f.id=? AND f.owner=? ORDER BY c.part').bind(file.id,user).all<{part:number;data:Buffer}>();
  if(chunks.results.some((c,i)=>c.part!==i))throw new AppError('Arquivo incompleto.',409);
  const data=Buffer.concat(chunks.results.map(c=>c.data));
  if(data.length!==file.bytes||createHash('sha256').update(data).digest('hex')!==file.sha256)throw new AppError('O arquivo não passou na verificação de integridade.',409);
  let pages;try{pages=await extractPdfText(data);}catch(e){throw new AppError(e instanceof Error?e.message:'Não foi possível extrair o PDF.',422);}
  await db.transaction(async tx=>{
   const current=await tx.prepare("SELECT sha256 FROM material_files WHERE id=? AND owner=? AND deck_id=? AND status='ready' FOR UPDATE").bind(file.id,user,a.deckId).first<{sha256:string}>();
   if(current?.sha256!==file.sha256)throw new AppError('O arquivo mudou durante a preparação.',409);
   await tx.prepare('DELETE FROM material_file_pages WHERE file_id=?').bind(file.id).run();
   await tx.prepare('INSERT INTO material_file_pages(file_id,page,content,sha256) SELECT ?,x.page,x.content,? FROM jsonb_to_recordset(?::jsonb) AS x(page integer,content text)').bind(file.id,file.sha256,JSON.stringify(pages)).run();
  });
  return json({pages:pages.length,emptyPages:pages.filter(p=>!p.content).length});
 }
 const current=await session(a.id,user);
 if(a.action==='advance'&&current.payload.answers.some(answer=>answer.eventId===a.eventId))return json({session:current});
 if(a.action==='message'){
  const prior=current.payload.messages.find(message=>message.role==='user'&&message.eventId===a.eventId);
  if(prior){if(prior.content!==a.question)throw new AppError('Este envio já possui outra pergunta.',409);return json({session:current});}
 }
 if(a.revision!==current.revision)throw new AppError('Este estudo mudou em outro acesso. Reabra para continuar.',409);
 let payload=current.payload;
 if(a.action==='advance'){
  if(current.kind!=='lesson')throw new AppError('Este estudo não é uma aula.');
  try{payload=advanceLesson(payload,a);}catch(e){throw new AppError(e instanceof Error?e.message:'Etapa inválida.',409);}
 }else{
  if(current.kind!=='chat')throw new AppError('Este estudo não é uma conversa.');
  if(payload.messages.length>=100)throw new AppError('Esta conversa atingiu 50 perguntas. Inicie outra conversa.');
  const deck=await db.prepare('SELECT title,source FROM decks WHERE id=? AND owner=?').bind(current.deck_id,user).first<{title:string;source:string}>();if(!deck)throw new AppError('Baralho não encontrado.',404);
  const [cards,notes]=await Promise.all([db.prepare('SELECT id,front,back,details FROM cards WHERE deck_id=? AND owner=? ORDER BY id').bind(current.deck_id,user).all<{id:string;front:string;back:string}>(),tutorMaterials(db,user,current.deck_id)]);
  const context=buildTutorContext({question:a.question,deckTitle:deck.title,source:deck.source,notes,cards:cards.results,history:payload.messages});
  let answer='Não encontrei trechos pertinentes. Adicione notas ou prepare um PDF deste baralho.',references=context.slice(0,0);
  if(context.length){
   const response=await ai([{type:'input_text',text:buildTutorPrompt(a.question,context,payload.messages)}],{type:'json_schema',name:'tutor_answer',strict:true,schema:{type:'object',properties:{answer:{type:'string'},citations:{type:'array',maxItems:12,items:{type:'string',enum:context.map(c=>c.id)}}},required:['answer','citations'],additionalProperties:false}});
   const result=z.object({answer:z.string().trim().min(1).max(20000),citations:z.array(z.string()).max(12)}).parse(JSON.parse(response));
   if(result.citations.some(c=>!context.some(item=>item.id===c)))throw new AppError('A IA retornou referências inválidas. A pergunta não foi salva.',502);
   answer=result.answer;references=[...new Set(result.citations)].map(c=>context.find(item=>item.id===c)!);
  }
  payload={...payload,messages:[...payload.messages,{role:'user',content:a.question,eventId:a.eventId},{role:'assistant',content:answer,references}]};
 }
 const updated=await db.prepare('UPDATE learning_sessions SET payload=?::jsonb,revision=revision+1,updated=? WHERE id=? AND owner=? AND revision=?').bind(JSON.stringify(payload),now,a.id,user,a.revision).run();
 if(!updated.meta.changes)throw new AppError('Outro acesso salvou primeiro. Reabra para conferir; nenhum progresso foi sobrescrito.',409);
 return json({session:await session(a.id,user)});
 }catch(e){return fail(e);}}
