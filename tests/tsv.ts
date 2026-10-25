import assert from 'node:assert/strict';
import test from 'node:test';

// Node runs this TypeScript file directly; the application keeps its usual TS config.
const { parseTsv, TSV_LIMITS } = await import(new URL('../lib/tsv.ts', import.meta.url).href) as typeof import('../lib/tsv');

test('preserves Unicode and internal whitespace, accepts BOM and CRLF', () => {
  const result = parseTsv('\uFEFF Qual é a função?\t Preservar ação, 中文 e 🧠. \r\nSegunda pergunta\tUma  resposta com dois espaços.');
  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.cards, [
    { line: 1, front: 'Qual é a função?', back: 'Preservar ação, 中文 e 🧠.' },
    { line: 2, front: 'Segunda pergunta', back: 'Uma  resposta com dois espaços.' },
  ]);
});

test('retains physical line numbers and counts explicitly ignored blank lines', () => {
  const result = parseTsv('\nA\tB\r\n   \r\nC\tD\n');
  assert.deepEqual(result.cards.map(card => card.line), [2, 4]);
  assert.equal(result.blankLines, 3);
});

test('accepts LF and old-style CR line endings', () => {
  assert.equal(parseTsv('A\tB\nC\tD').cards.length, 2);
  assert.equal(parseTsv('A\tB\rC\tD').cards.length, 2);
});

test('malformed paste never produces a partial import; every bad row is identified', () => {
  const result = parseTsv('Válida\tResposta\nSem separador\nA\tB\tC\n\tSem pergunta\nSem resposta\t');
  assert.deepEqual(result.cards, []);
  assert.deepEqual(result.issues.map(issue => issue.line), [2, 3, 4, 5]);
  assert.match(result.issues[0].message, /tabulação/);
  assert.match(result.issues[1].message, /3 colunas/);
});

test('a row containing only a tab is invalid rather than silently discarded', () => {
  const result = parseTsv('A\tB\n \t ');
  assert.deepEqual(result.cards, []);
  assert.equal(result.issues.length, 2);
  assert.ok(result.issues.every(issue => issue.line === 2));
});

test('100 cards are accepted, 101 are rejected with the first overflow line', () => {
  const hundred = Array.from({ length: 100 }, (_, i) => `Pergunta ${i}\tResposta ${i}`).join('\n');
  assert.equal(parseTsv(hundred).cards.length, 100);
  const result = parseTsv('\n' + hundred + '\nMais uma\tResposta');
  assert.deepEqual(result.cards, []);
  assert.equal(result.issues[0].line, 102);
  assert.match(result.issues[0].message, /101 linhas/);
});

test('field limits accept exact bounds and report both oversized fields', () => {
  assert.equal(parseTsv('a'.repeat(TSV_LIMITS.front) + '\t' + 'b'.repeat(TSV_LIMITS.back)).cards.length, 1);
  const result = parseTsv('a'.repeat(TSV_LIMITS.front + 1) + '\t' + 'b'.repeat(TSV_LIMITS.back + 1));
  assert.deepEqual(result.cards, []);
  assert.equal(result.issues.length, 2);
  assert.match(result.issues[0].message, /2.000/);
  assert.match(result.issues[1].message, /6.000/);
});

test('empty and excessive input produce actionable errors', () => {
  assert.equal(parseTsv(' \n\r\n').issues[0].line, 1);
  const result = parseTsv('a'.repeat(TSV_LIMITS.text + 1));
  assert.deepEqual(result.cards, []);
  assert.match(result.issues[0].message, /milhão/);
});
