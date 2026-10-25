export class PDFPage {
 setSize(width:number,height:number):void;
 getWidth():number;
 drawText(text:string,options?:{x?:number;y?:number;size?:number}):void;
}
export class PDFDocument {
 static load(data:ArrayBuffer|Uint8Array,options?:{updateMetadata?:boolean}):Promise<PDFDocument>;
 static create():Promise<PDFDocument>;
 getPageCount():number;
 getPageIndices():number[];
 getPages():PDFPage[];
 addPage(page?:PDFPage|[number,number]):PDFPage;
 copyPages(source:PDFDocument,indices:number[]):Promise<PDFPage[]>;
 save(options?:{useObjectStreams?:boolean;addDefaultPage?:boolean}):Promise<Uint8Array>;
}
