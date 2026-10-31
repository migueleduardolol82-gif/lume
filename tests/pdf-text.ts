import test from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument} from '../lib/vendor/pdf-lib.mjs';
import {extractPdfText} from '../lib/pdf-text.ts';
test('REG-PDF-PATH-001: local PDF resources work across platforms, preserve pages and reject empty scans',async()=>{
 const doc=await PDFDocument.create();doc.addPage().drawText('Carga: -1 mA');doc.addPage().drawText('Pressao: 20 kPa');
 const pages=await extractPdfText(await doc.save());
 assert.equal(pages.length,2);assert.match(pages[0].content,/-1 mA/);assert.equal(pages[1].page,2);assert.match(pages[1].content,/20 kPa/);
 const blank=await PDFDocument.create();blank.addPage();await assert.rejects(extractPdfText(await blank.save()),/transcrição/);
});
