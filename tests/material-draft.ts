import test from 'node:test';
import assert from 'node:assert/strict';
const {createMaterialDraft,editMaterialDraft,materialSave,confirmMaterialSave}=await import(new URL('../lib/material-draft.ts',import.meta.url).href) as typeof import('../lib/material-draft');
test('dirty notes retain the original concurrency baseline after another client updates the source',()=>{
 const draft=editMaterialDraft(createMaterialDraft('original'),'my edits');
 const refreshedServerSource='someone else changed it';
 assert.notEqual(materialSave(draft).expectedSource,refreshedServerSource);
 assert.deepEqual(materialSave(draft),{source:'my edits',expectedSource:'original'});
 assert.equal(confirmMaterialSave(draft).baseline,'my edits');
 assert.equal(draft.baseline,'original');
});
