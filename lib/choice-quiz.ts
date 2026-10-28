export type QuizCard = {id:string;front:string;back:string;details?:{hint?:string;tags?:string[];alternatives?:string[];template?:{type:string;correct?:boolean}}};
export type ChoiceQuestion = {cardId:string;correctId:string;options:{id:string;text:string}[];source?:'custom'|'related'|'deck';reviewNote?:string};
const answerKey=(text:string)=>text.normalize('NFC').trim().replace(/\s+/g,' ');
function shuffle<T>(items:readonly T[],random:()=>number){const copy=[...items];for(let i=copy.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]];}return copy;}
export function canBuildChoiceQuiz(cards:readonly QuizCard[]):boolean{try{buildChoiceQuestions(cards,()=>0);return true;}catch{return false;}}
/** Options are fixed when the session starts, so refreshes cannot move an answer. */
export function buildChoiceQuestions(cards:readonly QuizCard[],random:()=>number=Math.random):ChoiceQuestion[]{
 const ordinary=cards.filter(card=>!['true_false','cloze'].includes(card.details?.template?.type??''));
 const pool=[...new Map(ordinary.filter(c=>c.back.trim()).map(c=>[answerKey(c.back),c])).values()];
 if(!cards.length)throw new Error('Adicione pelo menos duas respostas diferentes ao baralho para usar o quiz de alternativas.');
 return cards.map(card=>{
  const template=card.details?.template;
  if(template?.type==='cloze')return {cardId:card.id,correctId:card.id,options:[]};
  if(template?.type==='true_false'&&typeof template.correct==='boolean')return {cardId:card.id,correctId:card.id,options:shuffle([{id:card.id,text:template.correct?'Verdadeiro':'Falso'},{id:card.id+':opposite',text:template.correct?'Falso':'Verdadeiro'}],random)};
  const correctKey=answerKey(card.back);
  const custom=[...new Set((card.details?.alternatives??[]).map(answerKey).filter(text=>text&&text!==correctKey))];
  let source:'custom'|'related'|'deck'='custom';
  let distractors:{id:string;text:string}[];
  if(custom.length)distractors=shuffle(custom,random).slice(0,3).map((text,i)=>({id:card.id+':alternative:'+i,text}));
  else{
   const available=pool.filter(c=>answerKey(c.back)!==correctKey);
   const tags=new Set((card.details?.tags??[]).map(t=>t.normalize('NFC').trim().toLocaleLowerCase('pt-BR')).filter(Boolean));
   const related=[...new Map(ordinary.filter(c=>answerKey(c.back)&&answerKey(c.back)!==correctKey&&(c.details?.tags??[]).some(t=>tags.has(t.normalize('NFC').trim().toLocaleLowerCase('pt-BR')))).map(c=>[answerKey(c.back),c])).values()];
   source=related.length>0&&related.length>=Math.min(3,available.length)?'related':'deck';
   // Related candidates are preferred even when the broader deck must fill remaining slots.
   const preferred=shuffle(related,random);
   const relatedKeys=new Set(related.map(c=>answerKey(c.back)));
   const selected=source==='related'?preferred:preferred.concat(shuffle(available.filter(c=>!relatedKeys.has(answerKey(c.back))),random));
   distractors=selected.slice(0,3).map(c=>({id:c.id,text:c.back}));
  }
  if(!correctKey||!distractors.length)throw new Error('Adicione pelo menos duas respostas diferentes ao baralho para usar o quiz de alternativas, ou alternativas personalizadas no cartão.');
  const reviewNote=source==='custom'?'Alternativas personalizadas. Confira se apenas a resposta de referência é correta.':source==='related'?'Alternativas de cartões com etiquetas em comum. Revise possíveis respostas equivalentes.':'Alternativas de outras respostas do baralho; faltaram opções com etiquetas em comum. Revise antes de estudar.';
  return {cardId:card.id,correctId:card.id,source,reviewNote,options:shuffle([{id:card.id,text:card.back},...distractors],random)};
 });
}
