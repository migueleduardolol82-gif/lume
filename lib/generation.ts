import type {CardDetails} from './content';
export const GENERATION_LIMITS = {cards:300,batch:20,pdfBytes:100_000_000,pdfPartBytes:45_000_000,imageBytes:3_000_000,chunkBytes:2_000_000} as const;
export type GeneratedCard={id:string;front:string;back:string;evidence?:string;evidenceStatus?:'matched_text'|'unverified_attachment'|'needs_review';details?:CardDetails};
export function nextBatchCount(target:number,received:number){return Math.min(GENERATION_LIMITS.batch,Math.max(0,target-received));}
export function appendUniqueCards(existing:GeneratedCard[],incoming:GeneratedCard[],target:number){
 const key=(s:string)=>s.normalize('NFC').trim().replace(/\s+/gu,' ');
 const factKey=(card:GeneratedCard)=>card.evidence?JSON.stringify([key(card.evidence),key(card.back)]):undefined;
 const facts=new Set(existing.map(factKey).filter((value):value is string=>Boolean(value)));
 const keys=new Set(existing.map(c=>key(c.front))),result=[...existing];
 for(const card of incoming){const k=key(card.front),fact=factKey(card);if(k&&!keys.has(k)&&(!fact||!facts.has(fact))&&result.length<target){keys.add(k);if(fact)facts.add(fact);result.push(card);}}
 return result;
}
export async function generateBatches(options:{target:number;initial:GeneratedCard[];stopped:()=>boolean;load:(count:number,cards:GeneratedCard[])=>Promise<GeneratedCard[]>;onCards:(cards:GeneratedCard[])=>void}){
 if(!Number.isInteger(options.target)||options.target<3||options.target>GENERATION_LIMITS.cards)throw Error('Escolha entre 3 e 300 cartões.');
 let cards=[...options.initial],stalled=0,attempts=0;
 while(cards.length<options.target&&!options.stopped()){
  if(++attempts>Math.ceil(options.target/GENERATION_LIMITS.batch)*3)throw Error('A geração trouxe menos cartões que o pedido. Revise os rascunhos ou continue depois.');
  const batch=await options.load(nextBatchCount(options.target,cards.length),cards);
  if(batch.length===0){if(cards.length)return cards;throw Error('Não há mais conteúdo suficiente para criar cartões com apoio na fonte. Revise os rascunhos ou acrescente material.');}
  const next=appendUniqueCards(cards,batch,options.target);stalled=next.length===cards.length?stalled+1:0;cards=next;options.onCards(cards);
  if(stalled>=2)throw Error('O material não trouxe cartões novos nestes lotes. Revise os rascunhos disponíveis ou use outro material.');
 }
 return cards;
}
