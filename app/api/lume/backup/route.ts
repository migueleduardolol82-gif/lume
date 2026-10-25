import {db} from '../../../../lib/database';
import {getOwner} from '../../../../lib/auth';
import {prepareRestore} from '../../../../lib/backup';
export const dynamic='force-dynamic';
export const maxDuration=120;
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(){
 const user=await getOwner();if(!user)return json({error:'Entre para exportar seus estudos.'},401);
 try{
  const body=await db.transaction(async tx=>{
   // A stable snapshot prevents cards/reviews from belonging to different instants.
   await tx.prepare('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ').run();
   const decks=await 
    tx.prepare('SELECT id,title,description,color,source,created,parent_id FROM decks WHERE owner=? ORDER BY created').bind(user.userId).all<{id:string}>();
   const cards=await 
    tx.prepare('SELECT id,deck_id,front,back,due,interval,repetitions,details FROM cards WHERE owner=? ORDER BY id').bind(user.userId).all<{deck_id:string}>();
   const reviews=await 
    tx.prepare('SELECT deck_id,card_id,rating,created FROM reviews WHERE owner=? ORDER BY created DESC LIMIT 3001').bind(user.userId).all();
   const messages=await 
    tx.prepare('SELECT m.deck_id,m.role,m.content,m.created,COALESCE(r.references_data,\'[]\'::jsonb) AS "references" FROM messages m LEFT JOIN message_references r ON r.message_id=m.id WHERE m.owner=? ORDER BY m.created DESC LIMIT 1001').bind(user.userId).all();
   const materialRows=await tx.prepare('SELECT * FROM materials WHERE owner=? ORDER BY created').bind(user.userId).all<{id:string;owner:string}>();
   const versions=await tx.prepare('SELECT v.material_id,v.revision,v.title,v.content,v.created FROM material_versions v JOIN materials m ON m.id=v.material_id WHERE m.owner=? ORDER BY v.revision DESC').bind(user.userId).all<{material_id:string}>();
   const materials=materialRows.results.map(({owner,...note})=>({...note,versions:versions.results.filter(v=>v.material_id===note.id).map(({material_id,...version})=>version)}));
   const files=await tx.prepare("SELECT id,deck_id,name,type,bytes,sha256,created FROM material_files WHERE owner=? AND status='ready'").bind(user.userId).all();
   if(materials.length>100)throw Error('LIMIT');
   if(decks.results.length>30||cards.results.length>900||reviews.results.length>3000||messages.results.length>1000)throw Error('LIMIT');
   return {version:2,materials,files:files.results,filesIncluded:false,exportedAt:new Date().toISOString(),decks:decks.results.map(d=>({...d,cards:cards.results.filter(c=>c.deck_id===d.id).map(({deck_id,...c})=>c)})),reviews:reviews.results,messages:messages.results.reverse()};
  });
  const text=JSON.stringify(body,null,2);if(Buffer.byteLength(text,'utf8')>4_000_000)throw Error('LIMIT');
  return new Response(text,{headers:{'Content-Type':'application/json; charset=utf-8','Content-Disposition':'attachment; filename="lume-backup.json"','Cache-Control':'no-store'}});
 }catch(e){if(e instanceof Error&&e.message==='LIMIT')return json({error:'Este backup ultrapassa o limite desta versão: 30 baralhos, 900 cartões, 3.000 revisões, 1.000 mensagens e 4 MB. Use exportação de conteúdo ou divida seus estudos.'},413);console.error('lume_backup_export_failed');return json({error:'Não foi possível exportar. Tente novamente.'},500);}
}
export async function POST(request:Request){
 const user=await getOwner();if(!user)return json({error:'Entre para restaurar seus estudos.'},401);
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return json({error:'Origem inválida.'},403);
 try{
  const raw=await request.text();if(Buffer.byteLength(raw,'utf8')>4_100_000)return json({error:'Use um backup de até 4 MB.'},413);
  let rows:ReturnType<typeof prepareRestore>;try{rows=prepareRestore(JSON.parse(raw));}catch(e){return json({error:e instanceof Error&&e.name!=='ZodError'?e.message:'Backup inválido ou acima dos limites desta versão.'},400);}
  const owner=user.userId;
  await db.transaction(async tx=>{
   if(rows.decks.length)await tx.prepare('INSERT INTO decks(id,owner,title,description,color,source,created,parent_id) SELECT x.id,?,x.title,x.description,x.color,x.source,x.created,x.parent_id FROM jsonb_to_recordset(?::jsonb) AS x(id text,title text,description text,color text,source text,created bigint,parent_id text)').bind(owner,JSON.stringify(rows.decks)).run();
   if(rows.materials.length)await tx.prepare('INSERT INTO materials(id,owner,deck_id,title,content,revision,created,updated) SELECT x.id,?,x.deck_id,x.title,x.content,x.revision,x.created,x.updated FROM jsonb_to_recordset(?::jsonb) AS x(id text,deck_id text,title text,content text,revision integer,created bigint,updated bigint)').bind(owner,JSON.stringify(rows.materials)).run();
   const versions=rows.materials.flatMap(note=>(note.versions.length?note.versions:[{revision:note.revision,title:note.title,content:note.content,created:note.updated}]).map(v=>({...v,material_id:note.id})));
   if(versions.length)await tx.prepare('INSERT INTO material_versions(material_id,revision,title,content,created) SELECT x.material_id,x.revision,x.title,x.content,x.created FROM jsonb_to_recordset(?::jsonb) AS x(material_id text,revision integer,title text,content text,created bigint)').bind(JSON.stringify(versions)).run();
   if(rows.cards.length)await tx.prepare("INSERT INTO cards(id,owner,deck_id,front,back,due,interval,repetitions,revision,details) SELECT x.id,?,x.deck_id,x.front,x.back,x.due,x.interval,x.repetitions,0,COALESCE(x.details,'{}'::jsonb) FROM jsonb_to_recordset(?::jsonb) AS x(id text,deck_id text,front text,back text,due bigint,interval integer,repetitions integer,details jsonb)").bind(owner,JSON.stringify(rows.cards)).run();
   if(rows.reviews.length)await tx.prepare('INSERT INTO reviews(id,owner,card_id,deck_id,rating,created) SELECT x.id,?,x.card_id,x.deck_id,x.rating,x.created FROM jsonb_to_recordset(?::jsonb) AS x(id text,card_id text,deck_id text,rating text,created bigint)').bind(owner,JSON.stringify(rows.reviews)).run();
   if(rows.messages.length)await tx.prepare('INSERT INTO messages(id,owner,deck_id,role,content,created) SELECT x.id,?,x.deck_id,x.role,x.content,x.created FROM jsonb_to_recordset(?::jsonb) AS x(id text,deck_id text,role text,content text,created bigint)').bind(owner,JSON.stringify(rows.messages)).run();
   const references=rows.messages.filter(message=>message.references?.length).map(message=>({message_id:message.id,references_data:message.references}));
   if(references.length)await tx.prepare('INSERT INTO message_references(message_id,references_data) SELECT x.message_id,x.references_data FROM jsonb_to_recordset(?::jsonb) AS x(message_id text,references_data jsonb)').bind(JSON.stringify(references)).run();
  });
  return json({restored:{decks:rows.decks.length,cards:rows.cards.length,reviews:rows.reviews.length,messages:rows.messages.length,materials:rows.materials.length,filesRestored:false}});
 }catch{console.error('lume_backup_restore_failed');return json({error:'Não foi possível restaurar. Nenhum dado desta importação foi salvo.'},500);}
}
