'use client';
import {useEffect,useRef,useState} from 'react';
import {readDraft,writeDraft,type StoredDraft} from '../lib/drafts';
export function useStoredDraft<T>(key:string|null,validate:(value:unknown)=>value is T){
 const [candidate,setCandidate]=useState<StoredDraft<T>|null>(null),[ready,setReady]=useState<string|null>(null),[message,setMessage]=useState(''),[error,setError]=useState('');
 const validator=useRef(validate),unreadable=useRef(false);validator.current=validate;
 useEffect(()=>{unreadable.current=false;setCandidate(null);setMessage('');setError('');if(!key){setReady(null);return;}try{setCandidate(readDraft(localStorage,key,validator.current));}catch(e){unreadable.current=true;setError(e instanceof Error?e.message:'Não foi possível acessar o rascunho.');}setReady(key);},[key]);
 function remember(value:T){if(!key||ready!==key||candidate||unreadable.current)return;try{writeDraft(localStorage,key,value);setMessage('Rascunho salvo neste dispositivo.');setError('');}catch{setError('Não foi possível guardar o rascunho neste dispositivo. Salve no servidor antes de sair.');}}
 function clear(){if(key)try{localStorage.removeItem(key);setError('');}catch{setError('Não foi possível remover o rascunho local.');return;}unreadable.current=false;setCandidate(null);setMessage('');}
 function accept(){setCandidate(null);setMessage('Rascunho recuperado. Confira antes de salvar no servidor.');}
 return {candidate,remember,clear,accept,message,error};
}
export default function DraftRecovery<T>({draft,onRecover}:{draft:ReturnType<typeof useStoredDraft<T>>;onRecover:(value:T)=>void}){
 return <>{draft.candidate?<aside className="notice" role="status"><p>Há um rascunho neste dispositivo, de {new Date(draft.candidate.updated).toLocaleString('pt-BR')}.</p><button type="button" className="secondary" onClick={()=>{onRecover(draft.candidate!.value);draft.accept();}}>Recuperar rascunho</button> <button type="button" className="text-button" onClick={draft.clear}>Descartar rascunho local</button></aside>:null}{draft.error?<p className="alert" role="alert">{draft.error} <button type="button" onClick={draft.clear}>Descartar rascunho local</button></p>:draft.message?<p className="muted" role="status">{draft.message}</p>:null}</>;
}
