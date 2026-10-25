import {z} from 'zod';
import {db} from '../../../../lib/database';
import {getOwner} from '../../../../lib/auth';
import {AppError} from '../../../../lib/ai';
export const dynamic='force-dynamic';
const id=z.string().min(1).max(100);
const action=z.discriminatedUnion('action',[
 z.object({action:z.literal('saveNote'),deckId:id,id,title:z.string().trim().min(1).max(120),content:z.string().max(24000),revision:z.number().int().min(0)}),
 z.object({action:z.literal('deleteNote'),deckId:id,id,revision:z.number().int().min(0)})
]);
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
async function list(owner:string,deckId:string){const [notes,files]=await Promise.all([db.prepare('SELECT * FROM materials WHERE owner=? AND deck_id=? ORDER BY updated DESC,id').bind(owner,deckId).all(),db.prepare("SELECT id,deck_id,name,type,bytes,sha256,created,status FROM material_files WHERE owner=? AND deck_id=? AND status='ready' ORDER BY created DESC,id").bind(owner,deckId).all()]);return {notes:notes.results,files:files.results};}
export async function GET(request:Request){try{
 const user=await getOwner();if(!user)throw new AppError('Entre para acessar os materiais.',401);
 const url=new URL(request.url),deckId=url.searchParams.get('deckId');if(!deckId)throw new AppError('Selecione um baralho.');
 if(!await db.prepare('SELECT id FROM decks WHERE id=? AND owner=?').bind(deckId,user.userId).first())throw new AppError('Baralho não encontrado.',404);
 const noteId=url.searchParams.get('id');if(noteId){const versions=await db.prepare('SELECT v.revision,v.title,v.content,v.created FROM material_versions v JOIN materials m ON m.id=v.material_id WHERE m.id=? AND m.owner=? AND m.deck_id=? ORDER BY v.revision DESC LIMIT 20').bind(noteId,user.userId,deckId).all();return json({versions:versions.results});}
 return json(await list(user.userId,deckId));
 }catch(error){return fail(error);}}
export async function POST(request:Request){try{
 const user=await getOwner();if(!user)throw new AppError('Entre para salvar materiais.',401);
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)throw new AppError('Origem inválida.',403);
 const raw=await request.text();if(Buffer.byteLength(raw)>100000)throw new AppError('Nota muito grande.',413);
 const checked=action.safeParse(JSON.parse(raw));if(!checked.success)throw new AppError('Confira os dados da nota.');const a=checked.data,owner=user.userId,now=Date.now();
 await db.transaction(async tx=>{
  if(!await tx.prepare('SELECT id FROM decks WHERE id=? AND owner=? FOR UPDATE').bind(a.deckId,owner).first())throw new AppError('Baralho não encontrado.',404);
  const note=await tx.prepare('SELECT * FROM materials WHERE id=? AND owner=? AND deck_id=? FOR UPDATE').bind(a.id,owner,a.deckId).first<{revision:number;title:string;content:string}>();
  if(a.action==='deleteNote'){
   if(!note)throw new AppError('Nota removida.',404);if(note.revision!==a.revision)throw new AppError('A nota mudou. Atualize antes de excluir.',409);
   await tx.prepare("UPDATE cards SET details=details-'materialId',revision=revision+1 WHERE owner=? AND deck_id=? AND details->>'materialId'=?").bind(owner,a.deckId,a.id).run();
   await tx.prepare('DELETE FROM materials WHERE id=? AND owner=?').bind(a.id,owner).run();return;
  }
  if(note&&note.title===a.title&&note.content===a.content)return;
  if(note&&note.revision!==a.revision)throw new AppError('A nota mudou em outro acesso. Seu rascunho foi mantido; atualize antes de salvar.',409);
  if(!note){if(a.revision!==0)throw new AppError('Nota não encontrada.',404);const count=await tx.prepare('SELECT count(*)::integer AS n FROM materials WHERE owner=? AND deck_id=?').bind(owner,a.deckId).first<{n:number}>();if((count?.n??0)>=30)throw new AppError('Use até 30 notas por baralho.');const result=await tx.prepare('INSERT INTO materials(id,owner,deck_id,title,content,revision,created,updated) VALUES (?,?,?,?,?,0,?,?) ON CONFLICT DO NOTHING').bind(a.id,owner,a.deckId,a.title,a.content,now,now).run();if(!result.meta.changes)throw new AppError('Identificador de nota indisponível.',409);}
  const revision=note?note.revision+1:0;
  if(note)await tx.prepare('UPDATE materials SET title=?,content=?,revision=?,updated=? WHERE id=? AND owner=?').bind(a.title,a.content,revision,now,a.id,owner).run();
  await tx.prepare('INSERT INTO material_versions(material_id,revision,title,content,created) VALUES (?,?,?,?,?)').bind(a.id,revision,a.title,a.content,now).run();
  await tx.prepare('DELETE FROM material_versions WHERE material_id=? AND revision NOT IN (SELECT revision FROM material_versions WHERE material_id=? ORDER BY revision DESC LIMIT 20)').bind(a.id,a.id).run();
 });return json({ok:true,...await list(owner,a.deckId)});
 }catch(error){return fail(error);}}
function fail(error:unknown){if(error instanceof AppError)return json({error:error.message},error.status);if(error instanceof SyntaxError)return json({error:'Dados inválidos.'},400);console.error('lume_materials_failed');return json({error:'Não foi possível concluir a operação de materiais.'},500);}
