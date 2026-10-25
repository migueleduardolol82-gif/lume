import test from 'node:test';
import assert from 'node:assert/strict';
import {realpathSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
test('REG-LOCAL-ROOT-001: Turbopack root contains linked dependencies and application',async()=>{
 const {default:config}=await import(new URL('../next.config.mjs',import.meta.url).href);
 const root=realpathSync(config.turbopack.root);
 for(const target of [fileURLToPath(new URL('../',import.meta.url)),realpathSync(new URL('../node_modules',import.meta.url))]){
  const relative=path.relative(root,target);
  assert.ok(!relative.startsWith('..')&&!path.isAbsolute(relative));
 }
});
