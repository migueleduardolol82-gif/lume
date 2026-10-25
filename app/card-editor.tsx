'use client';
import {useEffect,useState} from 'react';
import type {CardDetails,MaterialFile} from '../lib/content';
import {cardDetailsSchema} from '../lib/content';
import {cardTemplateSchema,TEMPLATE_LABELS,templateReference,type CardTemplate} from '../lib/card-templates';
import {RELEASE_FEATURES} from '../lib/release-features';
import {draftKey} from '../lib/drafts';
import DraftRecovery,{useStoredDraft} from './draft-recovery';
import {requestJson} from '../lib/sync';
type Editable={id:string;front:string;back:string;revision?:number;details?:CardDetails};
type FormDraft={id:string;revision?:number;front:string;back:string;hint:string;tags:string;alternatives:string;kind:keyof typeof TEMPLATE_LABELS;config:string;imageId:string;alt:string;correct:boolean};
function initial(card:Editable|null|undefined,id:string):FormDraft{
 const t=card?.details?.template;
 const config=t?.type==='multi_select'?t.choices.map(c=>(c.correct?'+ ':'- ')+c.text).join('\n'):t?.type==='cloze'?t.text:t?.type==='order'?t.items.join('\n'):t?.type==='match'?t.pairs.map(p=>p.left+' => '+p.right).join('\n'):'';
 return {id:card?.id||id,revision:card?.revision,front:card?.front||'',back:card?.back||'',hint:card?.details?.hint||'',tags:card?.details?.tags?.join(', ')||'',alternatives:card?.details?.alternatives?.join('\n')||'',kind:t?.type||'qa',config,imageId:t?.type==='image'?t.fileId:'',alt:t?.type==='image'?t.alt:'',correct:t?.type==='true_false'?t.correct:true};
}
const valid=(value:unknown):value is FormDraft=>{const d=value as FormDraft;return Boolean(d&&typeof d.id==='string'&&typeof d.kind==='string'&&d.kind in TEMPLATE_LABELS&&['front','back','hint','tags','alternatives','config','imageId','alt'].every(k=>typeof (d as unknown as Record<string,unknown>)[k]==='string'&&String((d as unknown as Record<string,unknown>)[k]).length<=24000)&&typeof d.correct==='boolean'&&(d.revision===undefined||Number.isInteger(d.revision)));};
export default function CardEditor({card,id,deckId='',draftScope,busy,pending,onSave}:{card?:Editable|null;id:string;deckId?:string;draftScope?:string;busy:boolean;pending:boolean;onSave:(card:Editable)=>Promise<boolean|void>}){
 const [draft,setDraft]=useState(()=>initial(card,id)),[error,setError]=useState(''),[files,setFiles]=useState<MaterialFile[]>([]);
 const recovery=useStoredDraft<FormDraft>(draftScope?draftKey(draftScope,deckId,'card:'+(card?.id||'new')):null,valid);
 const disabled=busy||pending||Boolean(recovery.candidate);
 useEffect(()=>{if(!RELEASE_FEATURES.cardTemplates||draft.kind!=='image'||!deckId)return;const controller=new AbortController();void requestJson<{files:MaterialFile[]}>('/api/lume/materials?deckId='+encodeURIComponent(deckId),{signal:controller.signal}).then(data=>setFiles(data.files.filter(file=>file.type.startsWith('image/')))).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Falha ao carregar imagens.');});return()=>controller.abort();},[draft.kind,deckId]);
 function change(patch:Partial<FormDraft>){const next={...draft,...patch};setDraft(next);recovery.remember(next);setError('');}
 function template():CardTemplate|undefined{
  const rows=draft.config.split('\n').map(s=>s.trim()).filter(Boolean);let value:unknown;
  if(draft.kind==='qa')return undefined;
  if(draft.kind==='multi_select'){if(rows.some(row=>!/^[-+] /.test(row)))throw Error('Use + para cada opção correta e - para cada opção incorreta.');value={type:draft.kind,choices:rows.map(row=>({text:row.slice(2),correct:row.startsWith('+ ')}))};}
  else if(draft.kind==='order')value={type:draft.kind,items:rows};
  else if(draft.kind==='match'){if(rows.some(row=>row.split('=>').length!==2))throw Error('Use um par por linha: termo => correspondência.');value={type:draft.kind,pairs:rows.map(row=>{const [left,right]=row.split('=>');return {left,right};})};}
  else if(draft.kind==='cloze')value={type:draft.kind,text:draft.config};
  else if(draft.kind==='true_false')value={type:draft.kind,correct:draft.correct};
  else value={type:'image',fileId:draft.imageId,alt:draft.alt};
  const parsed=cardTemplateSchema.safeParse(value);if(!parsed.success)throw Error(parsed.error.issues[0]?.message||'Confira os campos do tipo de cartão.');return parsed.data;
 }
 if(!RELEASE_FEATURES.cardTemplates&&draft.kind!=='qa')return <section><p className="notice">Este tipo de cartão está em preparação. Seu conteúdo foi preservado e não pode ser alterado nesta versão.</p><h3>{draft.front}</h3><p>{draft.back}</p><DraftRecovery draft={recovery} onRecover={setDraft}/></section>;
 return <form onSubmit={async event=>{event.preventDefault();setError('');try{if(!RELEASE_FEATURES.cardTemplates&&draft.kind!=='qa')throw Error('Este tipo de cartão está em preparação.');const t=template(),details:CardDetails={...card?.details,hint:draft.hint.trim(),tags:draft.tags.split(',').map(s=>s.trim()).filter(Boolean),alternatives:draft.alternatives.split('\n').map(s=>s.trim()).filter(Boolean)};delete details.template;if(t)details.template=t;const parsed=cardDetailsSchema.safeParse(details);if(!parsed.success)throw Error('Confira limites de dicas, tags e alternativas.');const saved=await onSave({id:draft.id,revision:draft.revision,front:draft.front,back:t&&t.type!=='image'?templateReference(t):draft.back,details:parsed.data});if(saved===true)recovery.clear();}catch(e){setError(e instanceof Error?e.message:'Confira o cartão antes de salvar.');}}}>
 <DraftRecovery draft={recovery} onRecover={setDraft}/>{error?<p className="alert" role="alert">{error}</p>:null}
 <label>Tipo de cartão<select aria-label="Tipo de cartão" value={draft.kind} disabled={disabled} onChange={e=>change({kind:e.target.value as FormDraft['kind']})}>{Object.entries(TEMPLATE_LABELS).filter(([value])=>RELEASE_FEATURES.cardTemplates||value==='qa').map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
 <label>Pergunta<textarea name="front" required maxLength={2000} value={draft.front} onChange={e=>change({front:e.target.value})} disabled={disabled}/></label>
 {draft.kind==='qa'||draft.kind==='image'?<label>Resposta<textarea name="back" required maxLength={6000} value={draft.back} onChange={e=>change({back:e.target.value})} disabled={disabled}/></label>:null}
 {['multi_select','cloze','order','match'].includes(draft.kind)?<label>{draft.kind==='multi_select'?'Opções: + correta, - incorreta; uma por linha':draft.kind==='cloze'?'Texto com lacunas marcadas como {{resposta}}':draft.kind==='order'?'Itens na ordem correta, um por linha':'Pares: termo => correspondência, um por linha'}<textarea aria-label="Conteúdo do exercício" required maxLength={6000} value={draft.config} disabled={disabled} onChange={e=>change({config:e.target.value})}/></label>:null}
 {draft.kind==='true_false'?<label>Resposta correta<select aria-label="Resposta correta" value={String(draft.correct)} disabled={disabled} onChange={e=>change({correct:e.target.value==='true'})}><option value="true">Verdadeiro</option><option value="false">Falso</option></select></label>:null}
 {draft.kind==='image'?<><label>Imagem dos materiais<select aria-label="Imagem dos materiais" value={draft.imageId} disabled={disabled} required onChange={e=>change({imageId:e.target.value})}><option value="">Selecione uma imagem…</option>{files.map(file=><option key={file.id} value={file.id}>{file.name}</option>)}</select></label><label>Descrição da imagem<input aria-label="Descrição da imagem" required maxLength={500} value={draft.alt} disabled={disabled} onChange={e=>change({alt:e.target.value})}/></label><p className="muted">Guarde uma imagem em Materiais antes de associá-la ao cartão. Escreva uma descrição que permita entender a pergunta.</p></>:null}
 <label>Dica opcional<input name="hint" maxLength={500} value={draft.hint} onChange={e=>change({hint:e.target.value})} disabled={disabled}/></label>
 <label>Tags separadas por vírgula<input name="tags" value={draft.tags} onChange={e=>change({tags:e.target.value})} disabled={disabled}/></label>
 {draft.kind==='qa'?<label>Alternativas incorretas (até 3, uma por linha)<textarea name="alternatives" value={draft.alternatives} onChange={e=>change({alternatives:e.target.value})} disabled={disabled}/></label>:null}
 <p className="muted">Revise o gabarito e as condições da pergunta. Até 10 tags de 50 caracteres.</p>
 {card?.details?.origin?<p className="muted">Origem: {card.details.origin}. A edição mantém a referência para conferência.</p>:null}
 <button className="primary" disabled={busy||Boolean(recovery.candidate)}>{pending&&!busy?'Confirmar criação':'Salvar cartão'}</button></form>;
}
