import {appendUniqueCards,GENERATION_LIMITS,type GeneratedCard} from './generation.ts';
export const PDF_AI_PART_BYTES=45_000_000;
export type PdfPart={file:Blob;name:string;firstPage?:number;lastPage?:number;totalPages?:number};
type PdfSource=Pick<Blob,'size'|'arrayBuffer'>&{name?:string};

/** Parse locally; copy contiguous page ranges without evaluating embedded PDF actions. */
export async function* splitPdfForAi(file:PdfSource,options:{maxPartBytes?:number;stopped?:()=>boolean}={}):AsyncGenerator<PdfPart>{
 if(file.size>100_000_000||file.size<=0)throw Error('Use um PDF de até 100 MB.');
 const max=options.maxPartBytes??PDF_AI_PART_BYTES;
 if(!Number.isInteger(max)||max<=0||max>PDF_AI_PART_BYTES)throw Error('Limite de divisão do PDF inválido.');
 const stopped=options.stopped??(()=>false),name=(file.name||'material.pdf').slice(0,150);
 if(stopped())return;
 // Small inputs retain the original bytes and avoid loading the parser.
 if(file.size<=max){yield {file:file as Blob,name};return;}
 const {PDFDocument}=await import('./vendor/pdf-lib.mjs');
 let source:Awaited<ReturnType<typeof PDFDocument.load>>;
 try{source=await PDFDocument.load(await file.arrayBuffer(),{updateMetadata:false});}
 catch{throw Error('Não foi possível abrir o PDF. Remova a senha ou exporte novamente como PDF válido.');}
 const total=source.getPageCount();if(!total)throw Error('O PDF não contém páginas.');
 async function* range(start:number,end:number):AsyncGenerator<PdfPart>{
  if(stopped())return;
  const output=await PDFDocument.create(),pages=await output.copyPages(source,Array.from({length:end-start},(_,i)=>start+i));
  for(const page of pages)output.addPage(page);
  const bytes=await output.save();
  if(stopped())return;
  if(bytes.byteLength>max){
   if(end-start===1)throw Error(`A página ${start+1} excede o limite por parte da IA. Comprima essa página e tente novamente.`);
   const middle=start+Math.floor((end-start)/2);yield* range(start,middle);yield* range(middle,end);return;
  }
  yield {file:new Blob([new Uint8Array(bytes)],{type:'application/pdf'}),name:name.replace(/\.pdf$/i,'')+`-paginas-${start+1}-${end}.pdf`,firstPage:start+1,lastPage:end,totalPages:total};
 }
 // Start with small ranges to avoid repeatedly serializing an entire 100 MB document.
 const pagesPerPart=Math.max(1,Math.floor(total/Math.ceil(file.size/max)));
 for(let start=0;start<total&&!stopped();start+=pagesPerPart)yield* range(start,Math.min(start+pagesPerPart,total));
}

/** Each AI request references exactly one bounded part; cleanup runs even on failure. */
export async function generatePdfCards(options:{target:number;initial:GeneratedCard[];parts:AsyncIterable<PdfPart>;stopped:()=>boolean;onCards:(cards:GeneratedCard[])=>void;upload:(part:PdfPart)=>Promise<string>;cleanup:(ticket:string)=>Promise<void>;generate:(ticket:string,count:number,previous:GeneratedCard[],part:PdfPart)=>Promise<GeneratedCard[]>}){
 const {target}=options;if(!Number.isInteger(target)||target<3||target>GENERATION_LIMITS.cards)throw Error('Escolha entre 3 e 300 cartões.');
 let cards=[...options.initial];
 for await(const part of options.parts){
  if(options.stopped()||cards.length>=target)break;
  const ticket=await options.upload(part);
  try{
   const remaining=target-cards.length;
   const quota=part.totalPages&&part.firstPage&&part.lastPage?Math.ceil(remaining*(part.lastPage-part.firstPage+1)/(part.totalPages-part.firstPage+1)):remaining;
   const goal=Math.min(target,cards.length+Math.max(1,quota)),maxAttempts=Math.ceil((goal-cards.length)/GENERATION_LIMITS.batch)*3;let stalled=0,attempts=0;
   while(cards.length<goal&&!options.stopped()){
    if(++attempts>maxAttempts)break;
    const batch=await options.generate(ticket,Math.min(GENERATION_LIMITS.batch,goal-cards.length),cards,part);
    if(!batch.length)break;
    const next=appendUniqueCards(cards,batch,goal);stalled=next.length===cards.length?stalled+1:0;cards=next;options.onCards(cards);
    if(stalled>=2)break;
   }
  }finally{await options.cleanup(ticket);}
 }
 if(!cards.length&&!options.stopped())throw Error('Não há conteúdo suficiente para criar cartões com apoio neste PDF.');
 return cards;
}
