<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Regras solicitadas pelo proprietário

- Antes de publicar mudanças, executar `npm.cmd test`, o build final e os testes de integração aplicáveis. Mudanças na IA também exigem avaliação de uma amostra real e revisão pedagógica; testes reais são explícitos e podem consumir créditos.
- Para cada bug confirmado, registrar a reprodução, criar um teste que falhe antes da correção, corrigir e demonstrar o teste passando. Preservar os testes para futuras alterações.
- Usar personas de estudante, professora e confiabilidade para avaliar a plataforma quando solicitado. Relatórios devem separar bugs demonstrados de sugestões e limitações.
- Testes de escrita usam somente dados sintéticos na identidade `Prévia local`, validando identidade e IDs antes de limpar suas fixtures. Nunca usar dados de produção como fixtures.
- Manter as funções e nomenclaturas mapeadas do Gizmo como referência de implementação, com marca Lume. Não afirmar equivalência total enquanto funções e fluxos estiverem pendentes.
- Nunca exibir credenciais ou carregar testes reais de IA automaticamente na suíte offline.
