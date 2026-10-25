import test from 'node:test';
import assert from 'node:assert/strict';
const {FILE_LIMITS,isMaterialFilePart}=await import(new URL('../lib/content.ts',import.meta.url).href);

test('PDF library accepts 100 MB with fifty bounded parts while image and total quotas stay explicit',()=>{
 assert.equal(FILE_LIMITS.pdf,100_000_000);
 assert.equal(FILE_LIMITS.chunk,2_000_000);
 assert.equal(FILE_LIMITS.image,3_000_000);
 assert.equal(FILE_LIMITS.storage,200_000_000);
 assert.equal(Math.ceil(FILE_LIMITS.pdf/FILE_LIMITS.chunk),50);
});

test('100 MB upload accepts the final part index 49 and rejects overflow or malformed indices',()=>{
 for(const part of [0,24,25,49])assert.equal(isMaterialFilePart(part),true);
 for(const part of [-1,50,100,1.5,NaN,Infinity])assert.equal(isMaterialFilePart(part),false);
});
