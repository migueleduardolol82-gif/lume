'use client';

import { useEffect, useRef, useState } from 'react';
import { parseTsv, TSV_LIMITS, type TsvResult } from '../lib/tsv';

type ImportCard = { id: string; front: string; back: string; line: number };
type Props = { busy: boolean; onSave: (cards: ImportCard[]) => Promise<boolean> };

export default function BulkImport({ busy, onSave }: Props) {
  const [text, setText] = useState('');
  const [result, setResult] = useState<TsvResult | null>(null);
  const [drafts, setDrafts] = useState<ImportCard[]>([]);
  const [preview, setPreview] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const previewHeading = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (preview) previewHeading.current?.focus(); }, [preview]);
  const invalidDrafts = drafts.some(card => !card.front.trim() || !card.back.trim()
    || card.front.length > TSV_LIMITS.front || card.back.length > TSV_LIMITS.back);

  function prepare() {
    const parsed = parseTsv(text);
    setResult(parsed);
    if (!parsed.issues.length) {
      setDrafts(parsed.cards.map(card => ({ ...card, id: crypto.randomUUID() })));
      setPreview(true);
    }
  }

  function insertTab() {
    const input = textarea.current;
    if (!input) return;
    const start = input.selectionStart, end = input.selectionEnd;
    setText(value => value.slice(0, start) + '\t' + value.slice(end));
    setResult(null);
    requestAnimationFrame(() => { input.focus(); input.setSelectionRange(start + 1, start + 1); });
  }

  if (preview) return <form className="bulk-import" onSubmit={async event => {
    event.preventDefault();
    if (!drafts.length || invalidDrafts || busy) return;
    await onSave(drafts.map(card => ({ ...card, front: card.front.trim(), back: card.back.trim() })));
  }}>
    <p ref={previewHeading} tabIndex={-1} className="muted" role="status">{drafts.length} cartões na prévia. Confira e edite antes de salvar.</p>
    {result && result.blankLines > 0 ? <p className="muted">Linhas vazias ignoradas: {result.blankLines}. Nenhuma linha com conteúdo foi descartada.</p> : null}
    <div className="draft-list">
      {drafts.map((card, index) => <fieldset key={card.id} className="import-draft" disabled={busy}>
        <legend>Cartão {index + 1} · linha {card.line}</legend>
        <label>Pergunta<textarea required maxLength={TSV_LIMITS.front} value={card.front} onChange={event => {
          const front = event.target.value;
          setDrafts(rows => rows.map(row => row.id === card.id ? { ...row, front } : row));
        }}/></label>
        <label>Resposta<textarea required maxLength={TSV_LIMITS.back} value={card.back} onChange={event => {
          const back = event.target.value;
          setDrafts(rows => rows.map(row => row.id === card.id ? { ...row, back } : row));
        }}/></label>
        <button className="text-button" type="button" onClick={() => setDrafts(rows => rows.filter(row => row.id !== card.id))} aria-label={`Remover cartão ${index + 1}, linha ${card.line}`}>Remover cartão</button>
      </fieldset>)}
    </div>
    {!drafts.length ? <p className="muted" role="status">Todos os cartões foram removidos da prévia. Volte ao texto para preparar outra importação.</p> : null}
    {invalidDrafts ? <p className="alert" role="alert">Preencha a pergunta e a resposta de todos os cartões antes de salvar.</p> : null}
    <div className="import-actions">
      <button className="secondary" type="button" disabled={busy} onClick={() => {
        setPreview(false);
        requestAnimationFrame(() => textarea.current?.focus());
      }}>Voltar ao texto</button>
      <button className="primary" type="submit" disabled={busy || !drafts.length || invalidDrafts}>{busy ? 'Salvando…' : `Salvar ${drafts.length} cartões`}</button>
    </div>
    <p className="muted">Se voltar ao texto e preparar outra prévia, ela substituirá as edições feitas aqui.</p>
  </form>;

  return <form className="bulk-import" onSubmit={event => { event.preventDefault(); prepare(); }}>
    <p className="muted" id="tsv-help">Copie duas colunas de uma planilha e cole abaixo, sem cabeçalho: pergunta na primeira coluna, resposta na segunda. Uma linha por cartão, até 100 cartões.</p>
    <pre className="tsv-example" aria-label="Formato: pergunta, tabulação, resposta">Pergunta <span>[TAB]</span> Resposta{'\n'}O que é uma célula? <span>[TAB]</span> A unidade básica da vida.</pre>
    <p className="muted" id="tsv-limits">Use uma tabulação real entre as colunas. Campos com quebras de linha ou tabulações internas não são suportados. Pergunta: até 2.000 caracteres. Resposta: até 6.000.</p>
    <label htmlFor="tsv-material">Cartões em duas colunas</label>
    <textarea ref={textarea} id="tsv-material" className="material tsv-input" value={text} disabled={busy} spellCheck={false}
      aria-describedby={result?.issues.length ? 'tsv-help tsv-limits tsv-errors' : 'tsv-help tsv-limits'} aria-invalid={Boolean(result?.issues.length)}
      onChange={event => { setText(event.target.value); setResult(null); }} placeholder={'Pergunta\tResposta\nOutra pergunta\tOutra resposta'}/>
    <button className="text-button" type="button" disabled={busy} onMouseDown={event => event.preventDefault()} onClick={insertTab}>Inserir tabulação no cursor</button>
    {result?.issues.length ? <div id="tsv-errors" className="tsv-errors" role="alert">
      <strong>Corrija as linhas abaixo. Nenhum cartão foi importado.</strong>
      <ul>{result.issues.map((issue, index) => <li key={`${issue.line}-${index}`}>Linha {issue.line}: {issue.message}</li>)}</ul>
    </div> : null}
    <button className="primary" type="submit" disabled={busy || !text.trim()}>Preparar prévia</button>
  </form>;
}
