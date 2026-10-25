export type TsvCard = { line: number; front: string; back: string };
export type TsvIssue = { line: number; message: string };
export type TsvResult = { cards: TsvCard[]; issues: TsvIssue[]; blankLines: number };

export const TSV_LIMITS = { cards: 100, front: 2000, back: 6000, text: 1_000_000 } as const;

/** Simple two-column TSV: one question, one tab, one answer per physical line. */
export function parseTsv(source: string): TsvResult {
  if (source.length > TSV_LIMITS.text) {
    return { cards: [], issues: [{ line: 1, message: 'O texto ultrapassa 1 milhão de caracteres. Divida a importação em partes menores.' }], blankLines: 0 };
  }
  const lines = source.replace(/^\uFEFF/, '').split(/\r\n|\n|\r/);
  const rows = lines.map((text, index) => ({ text, line: index + 1 }))
    .filter(row => row.text.trim() !== '' || row.text.includes('\t'));
  const blankLines = lines.length - rows.length;
  if (!rows.length) {
    return { cards: [], issues: [{ line: 1, message: 'Adicione uma pergunta e uma resposta separadas por tabulação.' }], blankLines };
  }
  if (rows.length > TSV_LIMITS.cards) {
    return { cards: [], issues: [{ line: rows[TSV_LIMITS.cards].line, message: `Há ${rows.length} linhas com conteúdo. O limite é 100 cartões por importação; divida o texto antes de continuar.` }], blankLines };
  }
  const cards: TsvCard[] = [], issues: TsvIssue[] = [];
  for (const row of rows) {
    const columns = row.text.split('\t');
    if (columns.length !== 2) {
      issues.push({ line: row.line, message: columns.length < 2
        ? 'Falta a tabulação entre a pergunta e a resposta. Copie duas colunas da planilha.'
        : `Foram encontradas ${columns.length} colunas. Use somente pergunta e resposta, separadas por uma tabulação.` });
      continue;
    }
    const [front, back] = columns.map(value => value.trim());
    const before = issues.length;
    if (!front) issues.push({ line: row.line, message: 'A pergunta está vazia.' });
    if (!back) issues.push({ line: row.line, message: 'A resposta está vazia.' });
    if (front.length > TSV_LIMITS.front) issues.push({ line: row.line, message: 'A pergunta ultrapassa 2.000 caracteres.' });
    if (back.length > TSV_LIMITS.back) issues.push({ line: row.line, message: 'A resposta ultrapassa 6.000 caracteres.' });
    if (issues.length === before) cards.push({ line: row.line, front, back });
  }
  // A mixed valid/invalid paste never becomes a partial import by accident.
  return { cards: issues.length ? [] : cards, issues, blankLines };
}
