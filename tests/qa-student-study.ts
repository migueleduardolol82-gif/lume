import test from 'node:test';
import assert from 'node:assert/strict';
const {normalizeAnswer}=await import(new URL('../lib/study.ts',import.meta.url).href) as typeof import('../lib/study');

test('QA estudante: quiz escrito nunca considera sinais e separadores matemáticos irrelevantes',()=>{
  for(const [expected,wrong] of [['-1','1'],['x-y','xy'],['0,5','05'],['2/3','23'],['a+b','ab']]){
    assert.notEqual(normalizeAnswer(expected),normalizeAnswer(wrong),`Respostas diferentes: ${expected} / ${wrong}`);
  }
});

test('QA estudante: quiz escrito tolera espaços e Unicode canônico, preservando caixa científica',()=>{
  assert.equal(normalizeAnswer('  revisão   ativa  '),normalizeAnswer('revisa\u0303o ativa'));
  assert.notEqual(normalizeAnswer('CO'),normalizeAnswer('Co'));
  assert.notEqual(normalizeAnswer('x²'),normalizeAnswer('x2'));
});
