import {z} from 'zod';
const text=z.string().trim().min(1).max(1000);
const key=(s:string)=>s.normalize('NFC').trim().replace(/\s+/gu,' ');
const unique=(items:string[])=>new Set(items.map(key)).size===items.length;
export const cardTemplateSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('multi_select'),choices:z.array(z.object({text,correct:z.boolean()}).strict()).min(2).max(8)}).strict(),
 z.object({type:z.literal('cloze'),text:z.string().trim().min(1).max(6000)}).strict(),
 z.object({type:z.literal('order'),items:z.array(text).min(2).max(8)}).strict(),
 z.object({type:z.literal('match'),pairs:z.array(z.object({left:text,right:text}).strict()).min(2).max(8)}).strict(),
 z.object({type:z.literal('true_false'),correct:z.boolean()}).strict(),
 z.object({type:z.literal('image'),fileId:z.string().min(1).max(100),alt:z.string().trim().min(1).max(500)}).strict()
]).superRefine((value,ctx)=>{
 const fail=(message:string)=>ctx.addIssue({code:'custom',message});
 if(value.type==='multi_select'&&(!unique(value.choices.map(c=>c.text))||!value.choices.some(c=>c.correct)||value.choices.every(c=>c.correct)))fail('Use opções distintas, ao menos uma correta e uma incorreta.');
 if(value.type==='multi_select'&&(value.choices.some(choice=>/[\r\n]/u.test(choice.text))||templateReference(value).length>6000))fail('Use uma linha por opção e um gabarito de até 6000 caracteres.');
 if(value.type==='order'&&!unique(value.items))fail('Os itens de ordenação devem ser distintos.');
 if(value.type==='match'&&(!unique(value.pairs.map(p=>p.left))||!unique(value.pairs.map(p=>p.right))))fail('Use termos e correspondências distintos.');
 if(value.type==='cloze'){const blanks=clozeParts(value.text).filter(p=>p.answer!==undefined);if(!blanks.length||blanks.length>8||/\{\{\{|\}\}\}/u.test(value.text)||value.text.replace(/\{\{[^{}\n]+\}\}/gu,'').match(/\{\{|\}\}/u)||blanks.some(p=>!p.answer?.trim()||p.answer.length>1000))fail('Marque de uma a oito lacunas com {{resposta}}, sem chaves aninhadas.');}
});
export type CardTemplate=z.infer<typeof cardTemplateSchema>;
export const TEMPLATE_LABELS={qa:'Pergunta e resposta',multi_select:'Múltipla seleção',cloze:'Preencher lacunas',order:'Ordenar itens',match:'Associar pares',true_false:'Verdadeiro ou falso',image:'Pergunta com imagem'} as const;
export function clozeParts(text:string):{text:string;answer?:string}[]{
 const result:{text:string;answer?:string}[]=[];let offset=0;
 for(const match of text.matchAll(/\{\{([^{}\n]+)\}\}/gu)){if(match.index>offset)result.push({text:text.slice(offset,match.index)});result.push({text:'',answer:match[1]});offset=match.index+match[0].length;}
 if(offset<text.length)result.push({text:text.slice(offset)});return result;
}
export function templateReference(template:CardTemplate):string{
 switch(template.type){case 'multi_select':return template.choices.filter(c=>c.correct).map(c=>c.text).join('\n');case 'cloze':return template.text.replace(/\{\{([^{}\n]+)\}\}/gu,'$1');case 'order':return template.items.map((text,index)=>`${index+1}. ${text}`).join('\n');case 'match':return template.pairs.map(p=>p.left+' → '+p.right).join('\n');case 'true_false':return template.correct?'Verdadeiro':'Falso';case 'image':return '';}
}
/** Exact authored answer checks, without semantic inference or fuzzy matching. */
export function evaluateTemplate(template:CardTemplate,answer:unknown):boolean{
 if(template.type==='true_false')return typeof answer==='boolean'&&answer===template.correct;
 if(template.type==='image')return false; // Image questions retain manual assessment of the authored back.
 if(!Array.isArray(answer)||answer.some(item=>typeof item!=='string'))return false;
 const values=answer as string[];
 if(template.type==='multi_select'){const correct=template.choices.flatMap((c,i)=>c.correct?[String(i)]:[]);return new Set(values).size===values.length&&values.length===correct.length&&correct.every(id=>values.includes(id));}
 if(template.type==='cloze'){const correct=clozeParts(template.text).flatMap(p=>p.answer!==undefined?[p.answer]:[]);return correct.length===values.length&&correct.every((text,i)=>key(text)===key(values[i]));}
 if(template.type==='order')return values.length===template.items.length&&values.every((value,i)=>value===String(i));
 return values.length===template.pairs.length&&values.every((value,i)=>value===String(i));
}
export function shuffledIndices(size:number,random:()=>number=Math.random):string[]{
 const ids=Array.from({length:size},(_,i)=>String(i));for(let i=ids.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]];}
 // Do not initially display the authored order as a completed exercise.
 if(size>1&&ids.every((value,i)=>value===String(i)))ids.push(ids.shift()!);return ids;
}
