import { db, type Database, type Statement } from "../../../lib/database";
import { getOwner } from "../../../lib/auth";
import { schedule } from "../../../lib/study";
import { ai, AppError } from "../../../lib/ai";
import { z } from "zod";
import {readTicket} from "../../../lib/upload-ticket";
import {releaseCardDetailsSchema,isCardAnswerConsistent} from '../../../lib/content';
import {buildTutorContext,buildTutorPrompt} from '../../../lib/tutor-context';
import {buildCardGenerationPrompt,assessGeneratedCards} from "../../../lib/card-quality";
import {tutorMaterials} from '../../../lib/tutor-materials';
export const dynamic = "force-dynamic";
export const maxDuration = 120;
const id = z.string().min(1).max(100);
const cardInputBase = z.object({ id, front: z.string().trim().min(1).max(2000), back: z.string().trim().min(1).max(6000),details:releaseCardDetailsSchema.optional() });
const cardInput=cardInputBase.refine(isCardAnswerConsistent,{message:'A resposta deve corresponder ao gabarito do exercício.'});
const colors = z.enum(["violet", "peach", "green", "blue"]);
const actions = z.discriminatedUnion("action", [
  z.object({ action: z.literal("createDeck"), id, title: z.string().trim().min(1).max(120), description: z.string().max(500).default(""), color: colors.default("violet"),parentId:id.optional() }),
  z.object({ action: z.literal("editDeck"), deckId: id, title: z.string().trim().min(1).max(120), description: z.string().max(500), color: colors }),
  z.object({ action:z.literal("saveSource"),deckId:id,source:z.string().max(24000),expectedSource:z.string().max(24000) }),
  z.object({ action: z.literal("deleteDeck"), deckId: id }),
  z.object({ action: z.literal("saveCards"), deckId: id, cards: z.array(cardInput).min(1).max(300), source: z.string().max(24000).optional(),expectedSource:z.string().max(24000).optional() }),
  z.object({ action: z.literal("editCard"), deckId: id, card: cardInput,revision:z.number().int().min(0).optional() }),
  z.object({ action: z.literal("deleteCard"), deckId: id, cardId: id }),
  z.object({ action: z.literal("review"), deckId: id, cardId: id, eventId: id, revision: z.number().int().min(0), rating: z.enum(["again", "hard", "good", "easy"]) }),
  z.object({ action: z.literal("generate"), deckId: id, text: z.string().max(24000), count: z.number().int().min(1).max(20), total:z.number().int().min(3).max(300).optional(), offset:z.number().int().min(0).max(299).default(0), previous:z.array(z.string().max(2000)).max(300).default([]), fileTicket:z.string().max(3000).optional(), file: z.object({ name: z.string().max(200), type: z.enum(["application/pdf", "image/png", "image/jpeg", "image/webp"]), data: z.string().max(4_100_000) }).optional() }),
  z.object({ action: z.literal("tutor"), deckId: id, question: z.string().trim().min(1).max(2000) }),
  z.object({ action: z.literal("importBackup"), decks: z.array(z.object({ title: z.string().trim().min(1).max(120), description: z.string().max(500).default(""), color: colors.default("violet"), cards: z.array(cardInputBase.omit({ id: true }).refine(isCardAnswerConsistent)).max(900) })).max(30) }),
]);
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
async function context() { const user = await getOwner(); if (!user) throw new AppError("Entre com sua conta para acessar seus estudos.", 401); if (!process.env.DATABASE_URL) throw new AppError("Banco de estudos indisponível.", 503); return { user, db }; }
async function state(owner: string, db: Database, name: string) {
  const [d,c,r,m] = await Promise.all([db.prepare("SELECT * FROM decks WHERE owner=? ORDER BY created DESC").bind(owner).all(), db.prepare("SELECT * FROM cards WHERE owner=? ORDER BY id").bind(owner).all(), db.prepare("SELECT * FROM reviews WHERE owner=? ORDER BY created DESC LIMIT 3000").bind(owner).all(), db.prepare("SELECT recent.*,COALESCE(r.references_data,'[]'::jsonb) AS references_data FROM (SELECT * FROM messages WHERE owner=? ORDER BY created DESC,id DESC LIMIT 1000) recent LEFT JOIN message_references r ON r.message_id=recent.id ORDER BY recent.created,recent.id").bind(owner).all()]);
  return { name, draftScope:owner, decks:d.results, cards:c.results, reviews:r.results, messages:m.results, aiReady:Boolean(process.env.OPENAI_API_KEY), serverTime:Date.now() };
}
export async function GET() { try { const {user,db}=await context();return json(await state(user.userId,db,user.displayName)); } catch(e){return handle(e);} }
export async function POST(request: Request) {
 try {
  const origin=request.headers.get("origin");if(origin&&origin!==new URL(request.url).origin)throw new AppError("Origem inválida.",403);
  const {user,db}=await context();const owner=user.userId;const now=Date.now();
  const raw=await request.text();if(Buffer.byteLength(raw,'utf8')>4_200_000)throw new AppError("Envio muito grande. Reduza o lote ou o tamanho do conteúdo.",413);
  let value:unknown;try{value=JSON.parse(raw);}catch{throw new AppError("Dados inválidos.");}
  const checked=actions.safeParse(value);if(!checked.success)throw new AppError("Confira os campos e limites de tamanho.");const a=checked.data;
  if(a.action==="createDeck")await db.transaction(async tx=>{
   if(a.parentId){if(a.parentId===a.id)throw new AppError("Um baralho não pode ser seu próprio pai.");if(!await tx.prepare("SELECT id FROM decks WHERE id=? AND owner=? FOR KEY SHARE").bind(a.parentId,owner).first())throw new AppError("Baralho pai não encontrado na sua conta.",404);}
   await tx.prepare("INSERT OR IGNORE INTO decks (id,owner,title,description,color,source,created,parent_id) VALUES (?,?,?,?,?,'',?,?)").bind(a.id,owner,a.title,a.description,a.color,now,a.parentId??null).run();
  });
  else if(a.action==="importBackup"){
   if(a.decks.reduce((count,d)=>count+d.cards.length,0)>900)throw new AppError("Importe até 900 cartões por vez.");
   const decks=a.decks.map(d=>({...d,id:crypto.randomUUID()}));
   const cards=decks.flatMap(d=>d.cards.map(c=>({...c,id:crypto.randomUUID(),deck_id:d.id})));
   const queries:Statement[]=[];
   if(decks.length)queries.push(db.prepare("INSERT INTO decks(id,owner,title,description,color,source,created) SELECT x.id,?,x.title,x.description,x.color,'',? FROM jsonb_to_recordset(?::jsonb) AS x(id text,title text,description text,color text)").bind(owner,now,JSON.stringify(decks)));
   if(cards.length)queries.push(db.prepare("INSERT INTO cards(id,owner,deck_id,front,back,due,interval,repetitions,revision,details) SELECT x.id,?,x.deck_id,x.front,x.back,?,0,0,0,COALESCE(x.details,'{}'::jsonb) FROM jsonb_to_recordset(?::jsonb) AS x(id text,deck_id text,front text,back text,details jsonb)").bind(owner,now,JSON.stringify(cards)));
   if(queries.length)await db.batch(queries);
  }else{
   const deck=await db.prepare("SELECT * FROM decks WHERE id=? AND owner=?").bind(a.deckId,owner).first<{title:string;source:string}>();if(!deck)throw new AppError("Baralho não encontrado na sua conta.",404);
   if(a.action==="deleteDeck")await db.transaction(async tx=>{await tx.prepare("SELECT id FROM decks WHERE id=? AND owner=? FOR UPDATE").bind(a.deckId,owner).first();await tx.batch([tx.prepare("DELETE FROM messages WHERE deck_id=? AND owner=?").bind(a.deckId,owner),tx.prepare("DELETE FROM reviews WHERE deck_id=? AND owner=?").bind(a.deckId,owner),tx.prepare("DELETE FROM cards WHERE deck_id=? AND owner=?").bind(a.deckId,owner),tx.prepare("DELETE FROM decks WHERE id=? AND owner=?").bind(a.deckId,owner)]);});
   else if(a.action==="editDeck")await db.prepare("UPDATE decks SET title=?,description=?,color=? WHERE id=? AND owner=?").bind(a.title,a.description,a.color,a.deckId,owner).run();
   else if(a.action==="saveSource"){
    const updated=await db.prepare("UPDATE decks SET source=? WHERE id=? AND owner=? AND source=?").bind(a.source,a.deckId,owner,a.expectedSource).run();
    if(!updated.meta.changes)throw new AppError("As notas mudaram em outro acesso. Sincronize antes de salvar novamente.",409);
   }
   else if(a.action==="saveCards"){
    await db.transaction(async tx=>{
     const current=await tx.prepare("SELECT source FROM decks WHERE id=? AND owner=? FOR UPDATE").bind(a.deckId,owner).first<{source:string}>();if(!current)throw new AppError("Baralho removido.",404);
     if(a.source!==undefined){if(current.source&&current.source!==a.source&&current.source!==a.expectedSource)throw new AppError("O material de referência mudou. Atualize antes de salvar este lote.",409);await tx.prepare("UPDATE decks SET source=? WHERE id=? AND owner=?").bind(a.source,a.deckId,owner).run();}
     for(const materialId of new Set(a.cards.map(c=>c.details?.materialId).filter(Boolean)))if(!await tx.prepare("SELECT id FROM materials WHERE id=? AND owner=? AND deck_id=?").bind(materialId,owner,a.deckId).first())throw new AppError("Nota de origem não encontrada neste baralho.",400);
     await tx.prepare("INSERT INTO cards (id,owner,deck_id,front,back,due,interval,repetitions,revision,details) SELECT x.id,?,?,x.front,x.back,?,0,0,0,COALESCE(x.details,'{}'::jsonb) FROM jsonb_to_recordset(?::jsonb) AS x(id text,front text,back text,details jsonb) ON CONFLICT DO NOTHING").bind(owner,a.deckId,now,JSON.stringify(a.cards)).run();
    });
   }else if(a.action==="editCard"){
    await db.transaction(async tx=>{
     await tx.prepare("SELECT id FROM decks WHERE id=? AND owner=? FOR KEY SHARE").bind(a.deckId,owner).first();
     const current=await tx.prepare("SELECT * FROM cards WHERE id=? AND deck_id=? AND owner=? FOR UPDATE").bind(a.card.id,a.deckId,owner).first<{front:string;back:string;revision:number;details:typeof a.card.details}>();
     if(!current)throw new AppError("Este cartão foi removido. Atualize o baralho antes de continuar.",404);
     if(a.revision!==undefined&&a.revision!==current.revision)throw new AppError("Este cartão mudou em outro acesso. Atualize antes de salvar.",409);
     const details={...(a.card.details??current.details??{})};
     if(!isCardAnswerConsistent({back:a.card.back,details}))throw new AppError('A resposta deve corresponder ao gabarito do exercício.');
     if(details.materialId&&!await tx.prepare("SELECT id FROM materials WHERE id=? AND owner=? AND deck_id=?").bind(details.materialId,owner,a.deckId).first())throw new AppError("Nota de origem não encontrada neste baralho.",400);
     if((current.front!==a.card.front||current.back!==a.card.back)&&details.evidence)details.evidenceStatus='needs_review';
     await tx.prepare("UPDATE cards SET front=?,back=?,details=?::jsonb,revision=revision+1 WHERE id=? AND deck_id=? AND owner=?").bind(a.card.front,a.card.back,JSON.stringify(details),a.card.id,a.deckId,owner).run();
    });
   }
   else if(a.action==="deleteCard")await db.prepare("DELETE FROM cards WHERE id=? AND deck_id=? AND owner=?").bind(a.cardId,a.deckId,owner).run();
   else if(a.action==="review"){
    await db.transaction(async tx=>{
     await tx.prepare("SELECT id FROM decks WHERE id=? AND owner=? FOR KEY SHARE").bind(a.deckId,owner).first();
     const c=await tx.prepare("SELECT * FROM cards WHERE id=? AND deck_id=? AND owner=? FOR UPDATE").bind(a.cardId,a.deckId,owner).first<{interval:number;repetitions:number;revision:number}>();
     if(!c)throw new AppError("Cartão removido.",404);
     if(await tx.prepare("SELECT id FROM reviews WHERE id=? AND owner=?").bind(a.eventId,owner).first())return;
     if(c.revision!==a.revision)throw new AppError("Este cartão mudou em outro aparelho. Atualize para continuar.",409);
     const n=schedule(c.interval,c.repetitions,a.rating,now);
     await tx.prepare("INSERT INTO reviews (id,owner,card_id,deck_id,rating,created) VALUES (?,?,?,?,?,?)").bind(a.eventId,owner,a.cardId,a.deckId,a.rating,now).run();
     await tx.prepare("UPDATE cards SET due=?,interval=?,repetitions=?,revision=revision+1 WHERE id=? AND owner=?").bind(n.due,n.interval,n.repetitions,a.cardId,owner).run();
    });
   }else if(a.action==="generate"){
    if(a.total!==undefined&&a.offset+a.count>a.total)throw new AppError("Lote inválido.");
    if(a.text.trim().length<30&&!a.file&&!a.fileTicket)throw new AppError("Adicione pelo menos 30 caracteres ou um arquivo.");
    const hasAttachment=Boolean(a.file||a.fileTicket);
    const content:unknown[]=[{type:"input_text",text:buildCardGenerationPrompt({count:a.count,total:a.total,offset:a.offset,title:deck.title,text:a.text,previous:a.previous,hasAttachment})}];
    if(a.fileTicket){let uploaded;try{uploaded=readTicket(a.fileTicket,owner,a.deckId,"file");}catch{throw new AppError("O envio do PDF expirou. Envie o arquivo novamente.");}content.push({type:"input_file",file_id:uploaded.id});}
    if(a.file){if(!a.file.data.startsWith(`data:${a.file.type};base64,`)||!/^[A-Za-z0-9+/=]+$/.test(a.file.data.split(",")[1]||""))throw new AppError("Arquivo inválido.");content.push(a.file.type==="application/pdf"?{type:"input_file",filename:a.file.name,file_data:a.file.data}:{type:"input_image",image_url:a.file.data});}
    const text=await ai(content,{type:"json_schema",name:"study_cards",strict:true,schema:{type:"object",properties:{cards:{type:"array",minItems:0,maxItems:a.count,items:{type:"object",properties:{front:{type:"string"},back:{type:"string"},evidence:{type:"string"}},required:["front","back","evidence"],additionalProperties:false}}},required:["cards"],additionalProperties:false}});
    let data:unknown;try{data=JSON.parse(text);}catch{throw new AppError("A IA retornou dados incompletos. Tente menos cartões.",502);}
    const valid=z.object({cards:z.array(cardInputBase.omit({id:true}).extend({evidence:z.string().trim().max(6000)}).refine(isCardAnswerConsistent)).max(a.count)}).safeParse(data);
    if(!valid.success)throw new AppError("Geração inválida. Tente novamente.",502);
    const assessed=assessGeneratedCards(valid.data.cards,{sourceText:a.text,hasAttachment,previous:a.previous});
    return json({cards:assessed.cards.map(c=>({...c,id:crypto.randomUUID()})),issues:assessed.issues,insufficient:valid.data.cards.length===0});
   }else if(a.action==="tutor"){
    const [cs,notes,history]=await Promise.all([db.prepare("SELECT id,front,back,details FROM cards WHERE deck_id=? AND owner=? ORDER BY id").bind(a.deckId,owner).all<{id:string;front:string;back:string;details:{evidence?:string;origin?:string;tags?:string[]}}>(),tutorMaterials(db,owner,a.deckId),db.prepare("SELECT role,content FROM messages WHERE deck_id=? AND owner=? ORDER BY created DESC LIMIT 8").bind(a.deckId,owner).all<{role:string;content:string}>()]);
    const context=buildTutorContext({question:a.question,deckTitle:deck.title,source:deck.source,notes,cards:cs.results,history:[...history.results].reverse()});
    let answer="Não encontrei trechos pertinentes nos materiais deste baralho para responder com segurança. Acrescente uma nota ou reformule a pergunta.",references= context.slice(0,0);
    if(context.length){
     const text=await ai([{type:"input_text",text:buildTutorPrompt(a.question,context,history.results.reverse())}],{type:"json_schema",name:"tutor_answer",strict:true,schema:{type:"object",properties:{answer:{type:"string"},citations:{type:"array",maxItems:12,items:{type:"string",enum:context.map(item=>item.id)}}},required:["answer","citations"],additionalProperties:false}});
     let result:unknown;try{result=JSON.parse(text);}catch{throw new AppError("O tutor retornou dados incompletos. Tente novamente.",502);}
     const parsed=z.object({answer:z.string().trim().min(1).max(20000),citations:z.array(z.string()).max(12)}).safeParse(result);if(!parsed.success||parsed.data.citations.some(id=>!context.some(item=>item.id===id)))throw new AppError("O tutor trouxe uma referência inválida. Tente novamente.",502);
     answer=parsed.data.answer;references=[...new Set(parsed.data.citations)].map(id=>context.find(item=>item.id===id)!);
    }
    const assistantId=crypto.randomUUID();
    await db.batch([db.prepare("INSERT INTO messages(id,owner,deck_id,role,content,created) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(),owner,a.deckId,"user",a.question,now),db.prepare("INSERT INTO messages(id,owner,deck_id,role,content,created) VALUES (?,?,?,?,?,?)").bind(assistantId,owner,a.deckId,"assistant",answer,now+1),db.prepare("INSERT INTO message_references(message_id,references_data) VALUES (?,?::jsonb)").bind(assistantId,JSON.stringify(references))]);return json({answer,references,...await state(owner,db,user.displayName)});
   }
  }
  return json(await state(owner,db,user.displayName));
 }catch(e){return handle(e);}
}
function handle(e:unknown){if(e instanceof AppError)return json({error:e.message},e.status);if(e instanceof Error&&["TimeoutError","AbortError"].includes(e.name))return json({error:"A IA demorou demais. Tente um material menor."},504);console.error("lume_request_failed",e instanceof Error?e.name:"unknown");return json({error:"Não foi possível concluir. Atualize e tente novamente."},500);}

