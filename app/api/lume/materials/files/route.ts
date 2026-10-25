import {z} from 'zod';
import {createHash} from 'node:crypto';
import {db} from '../../../../../lib/database';
import {getOwner} from '../../../../../lib/auth';
import {AppError} from '../../../../../lib/ai';
import {FILE_LIMITS,isMaterialFilePart} from '../../../../../lib/content';
export const dynamic='force-dynamic';export const maxDuration=120;
const id=z.string().min(1).max(100),fileType=z.enum(['application/pdf','image/png','image/jpeg','image/webp']);
const actions=z.discriminatedUnion('action',[z.object({action:z.literal('start'),id,deckId:id,name:z.string().trim().min(1).max(200),type:fileType,bytes:z.number().int().positive().max(FILE_LIMITS.pdf)}),z.object({action:z.literal('complete'),id,deckId:id}),z.object({action:z.literal('delete'),id,deckId:id})]);
type FileRow={id:string;deck_id:string;name:string;type:string;bytes:number;status:string;created:number;sha256:string|null};
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const hash=(data:Buffer)=>createHash('sha256').update(data).digest('hex');
async function user(request?:Request){const result=await getOwner();if(!result)throw new AppError('Entre para acessar arquivos.',401);if(request){const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)throw new AppError('Origem inválida.',403);}return result.userId;}
export async function POST(request:Request){try{
 const owner=await user(request),raw=await request.text();if(Buffer.byteLength(raw)>10000)throw new AppError('Dados muito grandes.',413);const parsed=actions.safeParse(JSON.parse(raw));if(!parsed.success)throw new AppError('Confira os dados do arquivo.');const a=parsed.data;
 const result=await db.transaction(async tx=>{
  if(!await tx.prepare('SELECT id FROM decks WHERE id=? AND owner=? FOR KEY SHARE').bind(a.deckId,owner).first())throw new AppError('Baralho não encontrado.',404);
  await tx.prepare('SELECT pg_advisory_xact_lock(hashtext(?))').bind('files:'+owner).run();
  const file=await tx.prepare('SELECT * FROM material_files WHERE id=? AND owner=? AND deck_id=? FOR UPDATE').bind(a.id,owner,a.deckId).first<FileRow>();
  if(a.action==='start'){
   if(a.type!=='application/pdf'&&a.bytes>FILE_LIMITS.image)throw new AppError('Use uma imagem de até 3 MB.');
   if(file){if(file.name!==a.name||file.bytes!==a.bytes||file.type!==a.type)throw new AppError('Este envio já possui outros dados.',409);return {file};}
   await tx.prepare("DELETE FROM material_files WHERE owner=? AND status='uploading' AND created<?").bind(owner,Date.now()-3600000).run();
   const usage=await tx.prepare('SELECT count(*)::integer AS count,COALESCE(sum(bytes),0)::bigint AS bytes FROM material_files WHERE owner=?').bind(owner).first<{count:number;bytes:number}>();
   if((usage?.count??0)>=FILE_LIMITS.count||(usage?.bytes??0)+a.bytes>FILE_LIMITS.storage)throw new AppError('A biblioteca comporta até 20 arquivos e 200 MB por espaço. Remova arquivos antes de enviar mais.',413);
   const inserted=await tx.prepare("INSERT INTO material_files(id,owner,deck_id,name,type,bytes,status,created) VALUES (?,?,?,?,?,?,'uploading',?) ON CONFLICT DO NOTHING").bind(a.id,owner,a.deckId,a.name,a.type,a.bytes,Date.now()).run();if(!inserted.meta.changes)throw new AppError('Identificador indisponível.',409);return {file:{id:a.id,status:'uploading'}};
  }
  if(!file)throw new AppError('Arquivo não encontrado.',404);
  if(a.action==='delete'){await tx.prepare('DELETE FROM material_files WHERE id=? AND owner=?').bind(a.id,owner).run();return {deleted:true};}
  if(file.status==='ready')return {file};
  const chunks=await tx.prepare('SELECT part,bytes,data FROM material_file_chunks WHERE file_id=? ORDER BY part').bind(a.id).all<{part:number;bytes:number;data:Buffer}>();
  if(chunks.results.length!==Math.ceil(file.bytes/FILE_LIMITS.chunk)||chunks.results.some((part,index)=>part.part!==index)||chunks.results.reduce((sum,part)=>sum+part.bytes,0)!==file.bytes)throw new AppError('O envio está incompleto. Envie novamente as partes que faltam.',409);
  const digest=createHash('sha256');for(const part of chunks.results)digest.update(part.data);const sha256=digest.digest('hex');
  await tx.prepare("UPDATE material_files SET status='ready',sha256=? WHERE id=? AND owner=?").bind(sha256,file.id,owner).run();return {file:{...file,status:'ready',sha256}};
 });return json(result);
 }catch(error){return fail(error);}}
export async function PUT(request:Request){try{
 const owner=await user(request),url=new URL(request.url),fileId=url.searchParams.get('id'),deckId=url.searchParams.get('deckId'),rawPart=url.searchParams.get('part'),part=Number(rawPart);
 if(!fileId||!deckId||rawPart===null||!/^\d+$/.test(rawPart)||!isMaterialFilePart(part))throw new AppError('Parte inválida.');
 const data=Buffer.from(await request.arrayBuffer());if(data.length>FILE_LIMITS.chunk)throw new AppError('Envie partes de até 2 MB.',413);
 await db.transaction(async tx=>{
  const file=await tx.prepare('SELECT * FROM material_files WHERE id=? AND owner=? AND deck_id=? FOR UPDATE').bind(fileId,owner,deckId).first<FileRow>();if(!file)throw new AppError('Envio não encontrado.',404);
  if(part>=Math.ceil(file.bytes/FILE_LIMITS.chunk)||data.length!==Math.min(FILE_LIMITS.chunk,file.bytes-part*FILE_LIMITS.chunk))throw new AppError('Tamanho da parte não corresponde ao arquivo.');
  const sha256=hash(data),existing=await tx.prepare('SELECT sha256 FROM material_file_chunks WHERE file_id=? AND part=?').bind(fileId,part).first<{sha256:string}>();if(existing){if(existing.sha256!==sha256)throw new AppError('Esta parte já possui outro conteúdo.',409);return;}
  if(file.status!=='uploading')throw new AppError('Arquivo já finalizado.',409);
  if(part===0){const signatures:Record<string,boolean>={'application/pdf':data.subarray(0,5).toString()==='%PDF-','image/png':data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),'image/jpeg':data[0]===255&&data[1]===216&&data[2]===255,'image/webp':data.subarray(0,4).toString()==='RIFF'&&data.subarray(8,12).toString()==='WEBP'};if(!signatures[file.type])throw new AppError('O conteúdo não corresponde ao tipo de arquivo.');}
  await tx.prepare('INSERT INTO material_file_chunks(file_id,part,bytes,sha256,data) VALUES (?,?,?,?,?)').bind(fileId,part,data.length,sha256,data).run();
 });return json({ok:true,part});
 }catch(error){return fail(error);}}
export async function GET(request:Request){try{
 const owner=await user(),url=new URL(request.url),file=await db.prepare("SELECT * FROM material_files WHERE id=? AND owner=? AND status='ready'").bind(url.searchParams.get('id'),owner).first<FileRow>();if(!file)throw new AppError('Arquivo não encontrado.',404);
 let part=0;const count=Math.ceil(file.bytes/FILE_LIMITS.chunk);
 const stream=new ReadableStream<Uint8Array>({async pull(controller){try{if(part>=count){controller.close();return;}const row=await db.prepare('SELECT c.data FROM material_file_chunks c JOIN material_files f ON f.id=c.file_id WHERE f.id=? AND f.owner=? AND c.part=?').bind(file.id,owner,part++).first<{data:Buffer}>();if(!row)throw Error('missing part');controller.enqueue(new Uint8Array(row.data));}catch(error){controller.error(error);}}});
 return new Response(stream,{headers:{'Content-Type':'application/octet-stream','Content-Length':String(file.bytes),'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }catch(error){return fail(error);}}
function fail(error:unknown){if(error instanceof AppError)return json({error:error.message},error.status);if(error instanceof SyntaxError)return json({error:'Dados inválidos.'},400);console.error('lume_material_file_failed');return json({error:'Não foi possível concluir o envio do arquivo.'},500);}
