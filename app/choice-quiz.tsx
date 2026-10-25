'use client';
import type {ChoiceQuestion} from '../lib/choice-quiz';
type Props={question:ChoiceQuestion;selected:string;revealed:boolean;busy:boolean;onSelect:(id:string)=>void};
export default function ChoiceQuiz({question,selected,revealed,busy,onSelect}:Props){
 const correct=selected===question.correctId;
 return <div className="choice-quiz">{question.reviewNote?<p className="muted">{question.reviewNote}</p>:null}<div className="quiz-options" role="group" aria-label="Alternativas">{question.options.map((option,index)=>{
  const right=revealed&&option.id===question.correctId,wrong=revealed&&option.id===selected&&!right;
  return <button type="button" key={option.id} disabled={revealed||busy} aria-pressed={selected===option.id} className={'quiz-option'+(right?' correct':wrong?' incorrect':'')} onClick={()=>onSelect(option.id)}><span className="option-letter">{String.fromCharCode(65+index)}</span><span>{option.text}{right?<strong className="option-result">✓ Resposta correta</strong>:wrong?<strong className="option-result">× Sua escolha</strong>:null}</span></button>;
 })}</div>{revealed?<p role="status" aria-live="polite" className={'quiz-feedback '+(correct?'correct':'incorrect')}>{correct?'✓ Acertou!':'Ainda não. Confira a alternativa correta acima.'}</p>:<p className="muted">Escolha a resposta correspondente ao cartão.</p>}</div>;
}
