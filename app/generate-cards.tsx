'use client';
import {useEffect,useRef,useState} from 'react';
import {GENERATION_LIMITS as limits,generateBatches,type GeneratedCard} from '../lib/generation';
import {z} from 'zod';
import {draftKey} from '../lib/drafts';
import DraftRecovery,{useStoredDraft} from './draft-recovery';
import {requestJson} from '../lib/sync';
type Props={draftScope?:string;deckId:string;source?:string;sourceTitle?:string;materialId?:string;aiReady:boolean;busy:boolean;pending:boolean;onBusyChange:(busy:boolean)=>void;onSave:(cards:GeneratedCard[],source:string)=>Promise<boolean|void>};
const generationDraftSchema=z.object({text:z.string().max(24000),target:z.number().int().min(3).max(300),cards:z.array(z.object({id:z.string().min(1).max(100),front:z.string().max(2000),back:z.string().max(6000),evidence:z.string().max(6000).optional(),evidenceStatus:z.enum(['matched_text','unverified_attachment','needs_review']).optional()}).strict()).max(300),attachment:z.object({name:z.string().max(200),type:z.enum(['application/pdf','image/png','image/jpeg','image/webp']),bytes:z.number().int().positive().max(limits.pdfBytes)}).optional()}).strict();
type GenerationDraft=z.infer<typeof generationDraftSchema>;
type Upload={ticket:string};
const post=(body:unknown)=>requestJson<Upload>('/api/lume/uploads',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)},100000);
function dataUrl(file:File){return new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(Error('Não foi possível ler a imagem.'));reader.readAsDataURL(file);});}
export default function GenerateCards({deckId,draftScope,source='',sourceTitle,materialId,aiReady,busy,pending,onBusyChange,onSave}:Props){
 const [text,setText]=useState(source),[file,setFile]=useState<File>(),[target,setTarget]=useState(20),[cards,setCards]=useState<GeneratedCard[]>([]),[progress,setProgress]=useState(''),[error,setError]=useState(''),[working,setWorking]=useState(false),[qualityNotes,setQualityNotes]=useState<string[]>([]);
 const [exhausted,setExhausted]=useState(false);
 const lastValidTarget=useRef(20);
 const [attachmentInfo,setAttachmentInfo]=useState<GenerationDraft['attachment']>();
 const recovery=useStoredDraft<GenerationDraft>(draftScope?draftKey(draftScope,deckId,'generation:'+ (materialId||'main')):null,(value):value is GenerationDraft=>generationDraftSchema.safeParse(value).success);
 useEffect(()=>{if(Number.isInteger(target)&&target>=3&&target<=limits.cards)lastValidTarget.current=target;if(text!==source||target!==20||cards.length||attachmentInfo)recovery.remember({text,target:lastValidTarget.current,cards,attachment:attachmentInfo});},[text,target,cards,attachmentInfo,source]);
 const running=useRef(false),stop=useRef(false);
 const frozen=busy||working||pending||cards.length>0||Boolean(recovery.candidate);
 async function generate(){
  if(running.current||busy||recovery.candidate)return;
  if(attachmentInfo&&!file){setError('Selecione novamente o arquivo original para continuar a geração. Os cartões recuperados podem ser salvos sem reenviar.');return;}
  if(!Number.isInteger(target)||target<3||target>limits.cards){setError('Escolha entre 3 e 300 cartões.');return;}
  if(!file&&text.trim().length<30){setError('Adicione pelo menos 30 caracteres ou um arquivo.');return;}
  running.current=true;stop.current=false;setExhausted(false);setWorking(true);onBusyChange(true);setError('');let upload:Upload|undefined,fileUpload:Upload|undefined,received=[...cards];
  try{
   const load=async(count:number,previous:GeneratedCard[],attachment:Record<string,unknown>={})=>{
    setProgress(`Gerando cartões ${previous.length+1} a ${previous.length+count} de ${target}…`);
    const batch=await requestJson<{cards:GeneratedCard[];issues?:{message:string}[]}>('/api/lume',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'generate',deckId,text,count,total:target,offset:previous.length,previous:previous.map(c=>c.front),...attachment})},135000);
    if(batch.issues?.length)setQualityNotes(notes=>[...new Set([...notes,...batch.issues!.map(issue=>issue.message)])]);
    return batch.cards;
   };
   const onCards=(next:GeneratedCard[])=>{received=next;setCards(next);};
   if(file?.type==='application/pdf'){
    setProgress('Preparando PDF; arquivos grandes serão divididos por páginas…');
    const {splitPdfForAi,generatePdfCards}=await import('../lib/pdf-generation');
    received=await generatePdfCards({target,initial:received,stopped:()=>stop.current,onCards,parts:splitPdfForAi(file,{stopped:()=>stop.current}),
     upload:async part=>{
      if(stop.current)throw Error('Envio interrompido. Os cartões recebidos foram mantidos.');
      const label=part.firstPage?`páginas ${part.firstPage}–${part.lastPage} de ${part.totalPages}`:'PDF';
      setProgress(`Preparando envio: ${label}…`);
      upload=await post({action:'start',deckId,name:part.name,bytes:part.file.size});const tickets:string[]=[];
      for(let offset=0;offset<part.file.size;offset+=limits.chunkBytes){
       if(stop.current)throw Error('Envio interrompido. Os cartões recebidos foram mantidos.');
       const ticket=await requestJson<Upload>('/api/lume/uploads',{method:'PUT',headers:{'Content-Type':'application/octet-stream','x-lume-deck':deckId,'x-lume-upload':upload.ticket,'x-lume-part':String(tickets.length)},body:part.file.slice(offset,offset+limits.chunkBytes)},100000);tickets.push(ticket.ticket);
       setProgress(`Enviando ${label}: ${Math.round(Math.min(offset+limits.chunkBytes,part.file.size)/part.file.size*100)}%`);
      }
      fileUpload=await post({action:'complete',deckId,ticket:upload.ticket,parts:tickets});upload=undefined;return fileUpload.ticket;
     },
     generate:(ticket,count,previous)=>load(count,previous,{fileTicket:ticket}),
     cleanup:async ticket=>{try{await post({action:'cancel',deckId,ticket,kind:'file'});}catch{/* The provider also expires temporary files. */}fileUpload=undefined;}
    });
    if(!stop.current&&received.length<target)setExhausted(true);
   }else{
    const attachment=file?{file:{name:file.name,type:file.type,data:await dataUrl(file)}}:{};
    received=await generateBatches({target,initial:received,stopped:()=>stop.current,onCards,load:async(count,previous)=>{const batch=await load(count,previous,attachment);if(!batch.length&&previous.length)setExhausted(true);return batch;}});
   }
   setProgress(received.length>=target?`${received.length} cartões prontos para revisão.`:!stop.current?`O material rendeu ${received.length} ${received.length===1?'cartão':'cartões'} com apoio na fonte. Revise e salve os rascunhos disponíveis.`:`Geração pausada com ${received.length} cartões. Você pode continuar ou salvar os rascunhos.`);
  }catch(e){setError(e instanceof Error?e.message:'Falha ao gerar. Os rascunhos já recebidos foram mantidos.');setProgress(`${received.length} de ${target} cartões recebidos.`);}
  finally{
   const cleanup=fileUpload||upload;if(cleanup){try{await post({action:'cancel',deckId,ticket:cleanup.ticket,kind:fileUpload?'file':'upload'});}catch{/* Provider expiry is limited to one hour if cleanup cannot complete. */}}
   running.current=false;setWorking(false);onBusyChange(false);
  }
 }
 function choose(file?:File){
  setError('');if(!file){setFile(undefined);setAttachmentInfo(undefined);return;}
  const pdf=file.type==='application/pdf'||(!file.type&&/\.pdf$/i.test(file.name));
  if(!pdf&&!['image/png','image/jpeg','image/webp'].includes(file.type)){setError('Use PDF, PNG, JPEG ou WebP.');return;}
  if(file.size>(pdf?limits.pdfBytes:limits.imageBytes)){setError(pdf?'Use um PDF de até 100 MB.':'Use uma imagem de até 3 MB.');return;}
  if(attachmentInfo&&cards.length&&(attachmentInfo.name!==file.name||attachmentInfo.bytes!==file.size)){setError('Selecione o mesmo arquivo usado nos cartões recuperados.');return;}
  setAttachmentInfo({name:file.name,type:pdf?'application/pdf':file.type as 'image/png'|'image/jpeg'|'image/webp',bytes:file.size});
  setFile(pdf&&file.type!=='application/pdf'?new File([file],file.name,{type:'application/pdf'}):file);
 }
 return <div className="generation">
  <DraftRecovery draft={recovery} onRecover={value=>{setText(value.text);setTarget(value.target);setCards(value.cards);setAttachmentInfo(value.attachment);setFile(undefined);}}/>{attachmentInfo&&!file?<p className="notice">Arquivo anterior: {attachmentInfo.name}. Selecione-o novamente para continuar a geração. Os cartões recuperados já podem ser salvos.</p>:null}<p className="muted">Gere de 3 a 300 cartões. PDFs de até 100 MB; imagens de até 3 MB. Quantidades maiores são geradas em lotes e podem levar alguns minutos.</p>
  <form onSubmit={event=>{event.preventDefault();void generate();}}>
   <label>Material de estudo<textarea className="material" disabled={frozen} value={text} maxLength={24000} onChange={e=>setText(e.target.value)} placeholder="Cole aqui suas anotações…"/></label>
   <label>PDF ou imagem<input disabled={busy||working||pending||Boolean(recovery.candidate)||(cards.length>0&&!attachmentInfo)} type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={e=>choose(e.target.files?.[0])}/></label>
   {file?<p className="muted">{file.name} · {(file.size/1000000).toFixed(1)} MB</p>:null}
   <label>Quantidade de cartões<input type="number" min={3} max={300} step={1} disabled={frozen} value={target} onChange={e=>setTarget(Number(e.target.value))}/></label>
   {!working&&(!exhausted||cards.length===0)&&cards.length<target?<button className="primary" disabled={busy||pending||!aiReady||Boolean(recovery.candidate)} type="submit">{cards.length?'Continuar geração':'Gerar rascunhos'}</button>:null}
  </form>
  {working?<button type="button" className="secondary" onClick={()=>{stop.current=true;setProgress('Parando após a etapa em andamento…');}}>Parar após esta etapa</button>:null}
  {progress?<p className="notice" role="status" aria-live="polite">{progress}</p>:null}
  {error?<p className="alert" role="alert">{error}</p>:null}
  {qualityNotes.length?<aside className="quality-notes"><strong>Revisão de qualidade</strong><ul>{qualityNotes.map(note=><li key={note}>{note}</li>)}</ul></aside>:null}
  {!aiReady?<p className="muted">A configuração de IA precisa estar disponível no servidor.</p>:null}
  {cards.length?<><p className="muted">Confira as perguntas e respostas antes de salvar. Os rascunhos são guardados neste dispositivo quando há espaço disponível; confira o aviso de salvamento local.</p><div className="draft-list">{cards.map((card,index)=><fieldset className="import-draft" key={card.id} disabled={busy||working||pending}><legend>Cartão {index+1}</legend><label>Pergunta<textarea required maxLength={2000} value={card.front} onChange={e=>{const front=e.target.value;setCards(rows=>rows.map(row=>row.id===card.id?{...row,front,evidenceStatus:row.evidence?'needs_review':row.evidenceStatus}:row));}}/></label><label>Resposta<textarea required maxLength={6000} value={card.back} onChange={e=>{const back=e.target.value;setCards(rows=>rows.map(row=>row.id===card.id?{...row,back,evidenceStatus:row.evidence?'needs_review':row.evidenceStatus}:row));}}/></label>{card.evidence?<details className="card-evidence"><summary>Trecho de apoio · {card.evidenceStatus==='needs_review'?'revisar após edição':card.evidenceStatus==='matched_text'?'encontrado no texto':'conferir no anexo'}</summary><blockquote>{card.evidence}</blockquote><p className="muted">Confira se o trecho sustenta a resposta, especialmente após editar o cartão. A origem e este trecho serão preservados no cartão salvo.</p></details>:null}<button type="button" className="text-button" onClick={()=>setCards(rows=>rows.filter(row=>row.id!==card.id))}>Remover cartão {index+1}</button></fieldset>)}</div><button className="primary" disabled={busy||working||cards.some(c=>!c.front.trim()||!c.back.trim())} onClick={async()=>{const saved=await onSave(cards.map(card=>({id:card.id,front:card.front,back:card.back,details:{origin:(attachmentInfo?.name||sourceTitle||'Notas do baralho').slice(0,200),sourceType:attachmentInfo?.type==='application/pdf'?'pdf':attachmentInfo?'image':materialId?'material':'text',...(card.evidence?{evidence:card.evidence,evidenceStatus:card.evidenceStatus}:{}),...(materialId?{materialId}:{})}})),(text+(attachmentInfo?'\nArquivo usado: '+attachmentInfo.name:'')).slice(0,24000));if(saved===true)recovery.clear();}}>{pending?'Confirmar criação':`Salvar ${cards.length} cartões`}</button></>:null}
  <p className="muted">A quantidade final depende do conteúdo disponível. PDFs com muitas páginas podem exceder o limite de processamento da IA mesmo após a divisão em partes.</p>
 </div>;
}
