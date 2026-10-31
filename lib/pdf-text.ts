import {createRequire} from 'node:module';
import {dirname,join} from 'node:path';
export type PdfPageText={page:number;content:string};
export async function extractPdfText(data:Uint8Array):Promise<PdfPageText[]>{
 if(data.byteLength>30_000_000)throw Error('Para preparar o Tutor, divida PDFs maiores que 30 MB. O original continua guardado.');
 const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
 const packageRoot=dirname(createRequire(import.meta.url).resolve('pdfjs-dist/package.json'));
 const resource=(directory:string)=>join(packageRoot,directory).replaceAll('\\','/')+'/';
 const loading=getDocument({data:new Uint8Array(data),useSystemFonts:true,useWorkerFetch:false,disableFontFace:true,cMapUrl:resource('cmaps'),standardFontDataUrl:resource('standard_fonts'),wasmUrl:resource('wasm')});
 try{
  const pdf=await loading.promise;
  if(pdf.numPages>300)throw Error('Divida o PDF em documentos de até 300 páginas para o Tutor.');
  const pages:PdfPageText[]=[];let total=0;
  for(let page=1;page<=pdf.numPages;page++){
   const p=await pdf.getPage(page);const text=await p.getTextContent();
   const content=text.items.map(item=>'str' in item?item.str+('hasEOL' in item&&item.hasEOL?'\n':' '):'').join('').trim();
   total+=content.length;if(total>1_000_000)throw Error('O texto ultrapassa o limite de preparação. Divida o PDF em partes menores.');
   pages.push({page,content});p.cleanup();
  }
  if(!pages.some(p=>p.content))throw Error('Este PDF não tem texto extraível. Para digitalizações, adicione uma transcrição nas notas.');
  return pages;
 }finally{await loading.destroy();}
}
