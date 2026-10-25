export type WrittenFeedback = {kind:'exact'|'possible_partial'|'different';message:string;requiresConfirmation:boolean};
const normalize=(text:string)=>text.normalize('NFC').trim().replace(/\s+/gu,' ');
const negation=/(?<![\p{L}\p{M}])(?:não|nunca|jamais|nem|sem|tampouco|nenhum[ao]?s?|ninguém|nada|exceto|salvo|menos|nega|negativ[oa]s?|not|no|never|without|except)(?![\p{L}\p{M}])/iu;
/** Hints are authored metadata. No answer-derived or generated hint is invented here. */
export function getQuizHint(card:{details?:{hint?:string}}):string|null{return card.details?.hint?.trim()||null;}

/** Text similarity is not factual correctness; only the learner can accept a partial answer. */
export function evaluateWrittenAnswer(answer:string,reference:string):WrittenFeedback{
 const actual=normalize(answer),expected=normalize(reference);
 if(actual&&actual===expected)return {kind:'exact',message:'Resposta igual à referência.',requiresConfirmation:false};
 const different:WrittenFeedback={kind:'different',message:'Compare sua resposta com a referência e avalie o significado.',requiresConfirmation:true};
 if(!actual||!expected)return different;
 // Any number, operator, formula-like token, or negation prevents a similarity suggestion.
 // Case and accents remain significant (CO/Co, avó/avô); no fuzzy normalization is applied.
 if(negation.test(actual)||negation.test(expected)||/[\p{N}+=<>−×÷^*/%°µμΩ-]/u.test(actual+expected))return different;
 if(/[^\p{L}\p{M}\s.,;:!?()'’"-]/u.test(actual+expected)||/\b[A-Z][A-Z]+\b/u.test(actual+expected))return different;
 const tokenize=(text:string)=>text.split(/\s+/u);
 const words=tokenize(actual),referenceWords=tokenize(expected);
 if(words.length<2||words.length>=referenceWords.length||words.length/referenceWords.length<0.5)return different;
 const starts=referenceWords.map((_,i)=>i).some(i=>words.every((word,j)=>referenceWords[i+j]===word));
 if(!starts)return different;
 return {kind:'possible_partial',message:'Sua resposta contém parte literal da referência. Confira o que falta e confirme sua avaliação; isto não comprova que esteja correta.',requiresConfirmation:true};
}
