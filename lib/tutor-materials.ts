import type {Database} from './database';
export async function tutorMaterials(db:Database,owner:string,deckId:string){
 const [notes,pages]=await Promise.all([
  db.prepare('SELECT id,title,content,revision FROM materials WHERE deck_id=? AND owner=? ORDER BY updated DESC').bind(deckId,owner).all<{id:string;title:string;content:string;revision:number}>(),
  db.prepare("SELECT f.id,f.name,p.page,p.content FROM material_file_pages p JOIN material_files f ON f.id=p.file_id WHERE f.deck_id=? AND f.owner=? AND f.status='ready' AND f.sha256=p.sha256 ORDER BY f.created,p.page").bind(deckId,owner).all<{id:string;name:string;page:number;content:string}>(),
 ]);
 return [...notes.results,...pages.results.filter(p=>p.content.trim()).map(p=>({id:`pdf:${p.id}:p${p.page}`,title:`${p.name} · página ${p.page}`,content:p.content,revision:0}))];
}
