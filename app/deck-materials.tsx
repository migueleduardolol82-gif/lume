'use client';
import {useState,useEffect} from 'react';
import {createMaterialDraft,editMaterialDraft,materialSave,confirmMaterialSave} from '../lib/material-draft';
import {draftKey} from '../lib/drafts';
import DraftRecovery,{useStoredDraft} from './draft-recovery';
type Props={deckId?:string;draftScope?:string;source:string;busy:boolean;onSave:(source:string,expectedSource:string)=>Promise<boolean>;onGenerate:()=>void;onDirtyChange?:(dirty:boolean)=>void};
type NoteDraft=ReturnType<typeof createMaterialDraft>;
const valid=(value:unknown):value is NoteDraft=>Boolean(value&&typeof value==='object'&&['text','baseline'].every(key=>typeof (value as Record<string,unknown>)[key]==='string'&&String((value as Record<string,unknown>)[key]).length<=24000));
export default function DeckMaterials({deckId='',draftScope,source,busy,onSave,onGenerate,onDirtyChange}:Props){
 const [draft,setDraft]=useState(()=>createMaterialDraft(source)),[saved,setSaved]=useState(false);
 const recovery=useStoredDraft(draftScope?draftKey(draftScope,deckId,'main-note'):null,valid);
 const dirty=draft.text!==draft.baseline;
 useEffect(()=>{onDirtyChange?.(dirty);},[dirty,onDirtyChange]);
 return <section className="panel material-panel"><div className="section-heading"><div><p className="eyebrow">MATERIAIS</p><h2>Notas e material de referência</h2><p className="muted">Organize o conteúdo usado pelo tutor e pela geração de cartões.</p></div></div>
 <DraftRecovery draft={recovery} onRecover={value=>{setDraft(value);setSaved(false);}}/><form onSubmit={async event=>{event.preventDefault();setSaved(false);const payload=materialSave(draft);if(await onSave(payload.source,payload.expectedSource)){setDraft(confirmMaterialSave(draft));recovery.clear();setSaved(true);}}}><label>Notas<textarea aria-label="Notas do baralho" value={draft.text} maxLength={24000} disabled={busy||Boolean(recovery.candidate)} onChange={event=>{const next=editMaterialDraft(draft,event.target.value);setDraft(next);recovery.remember(next);setSaved(false);}} placeholder="Cole ou escreva o conteúdo que você quer estudar."/></label><p className="muted">{draft.text.length.toLocaleString('pt-BR')} / 24.000 caracteres. Arquivos enviados à IA são temporários; guarde seu PDF original.</p><div className="material-actions"><button className="primary" disabled={busy||Boolean(recovery.candidate)||draft.text===draft.baseline}>Salvar notas</button><button type="button" className="secondary" disabled={busy||draft.text!==source} onClick={onGenerate}>Criar cartões com IA</button></div>{source!==draft.baseline?<p className="alert" role="status">As notas salvas mudaram. Seu rascunho foi mantido. Copie o que deseja preservar e <button type="button" disabled={busy} onClick={()=>{setDraft(createMaterialDraft(source));recovery.clear();setSaved(false);}}>carregue as notas atuais</button>.</p>:null}{saved?<p className="notice" role="status">Notas salvas neste baralho.</p>:null}{draft.text!==source?<p className="muted">Salve as notas para usá-las na geração.</p>:null}</form></section>;
}
