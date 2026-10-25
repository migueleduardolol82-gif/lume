export type DraftStorage=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
export type StoredDraft<T>={version:1;updated:number;value:T};
export const draftKey=(scope:string,deckId:string,editor:string)=>'lume:draft:v1:'+encodeURIComponent(scope)+':'+encodeURIComponent(deckId)+':'+encodeURIComponent(editor);
export function readDraft<T>(storage:DraftStorage,key:string,valid:(value:unknown)=>value is T):StoredDraft<T>|null{
 const raw=storage.getItem(key);if(!raw)return null;if(raw.length>1_000_000)throw Error('O rascunho local ultrapassa o limite de recuperação.');
 let parsed:unknown;try{parsed=JSON.parse(raw);}catch{throw Error('O rascunho local não pôde ser lido. Descarte-o para iniciar outro.');}
 const data=parsed as Partial<StoredDraft<T>>;if(!data||data.version!==1||!Number.isFinite(data.updated)||!valid(data.value))throw Error('O formato do rascunho local não é compatível.');return data as StoredDraft<T>;
}
export function writeDraft<T>(storage:DraftStorage,key:string,value:T,now=Date.now()){
 const data=JSON.stringify({version:1,updated:now,value});if(data.length>1_000_000)throw Error('O rascunho excede 1 MB. Salve seus cartões no servidor antes de sair.');storage.setItem(key,data);
}
