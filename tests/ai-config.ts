import test from 'node:test';
import assert from 'node:assert/strict';
const {aiConfig}=await import(new URL('../lib/ai-config.ts',import.meta.url).href) as typeof import('../lib/ai-config');
test('legacy default keeps existing model and effort',()=>{
 assert.deepEqual(aiConfig({}),{model:'gpt-5-mini',effort:'minimal',maxOutputTokens:4000});
});
test('quality model uses compatible reasoning and room for reasoning plus final cards',()=>{
 assert.deepEqual(aiConfig({OPENAI_MODEL:'gpt-6-astra'}),{model:'gpt-6-astra',effort:'medium',maxOutputTokens:12000});
});
test('incompatible or malformed options fail before a paid API request',()=>{
 assert.throws(()=>aiConfig({OPENAI_MODEL:'gpt-6-astra',OPENAI_REASONING_EFFORT:'minimal'}),/incompatível/);
 assert.throws(()=>aiConfig({OPENAI_MAX_OUTPUT_TOKENS:'-1'}),/tokens/);
 assert.throws(()=>aiConfig({OPENAI_REASONING_EFFORT:'unknown'}),/raciocínio/);
});
