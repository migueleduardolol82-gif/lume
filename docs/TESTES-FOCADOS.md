# Correção de bugs e publicação

## Durante uma correção

1. Reproduzir com dados sintéticos; registrar a versão, os passos, o esperado e o observado em REGRESSOES.md.
2. Criar o menor teste que detecte o erro, no módulo, componente ou rota responsável. Um teste existente pode ser ampliado quando o caso pertence ao mesmo erro. Não duplicar toda a plataforma em cada teste.
3. Rodar contra a implementação com erro e guardar a falha. Falhas de compilação ou de fixture não comprovam o bug.
4. Corrigir e executar somente o arquivo/caso correspondente durante a iteração:

```sh
npm run test:focus -- tests/search-regression-ui.mjs --name REG-SEARCH-001
npm run test:focus -- tests/learning-ui.mjs --name REG-HISTORY-RACE-001
npm run test:focus -- tests/learning-api-offline.mjs --name REG-CHAT-RETRY-001
```

O executor aceita arquivos explícitos de testes offline. Bloqueia rede e remove credenciais herdadas; não aceita testes de integração ou IA real. Os testes PostgreSQL em memória usam PGlite e as rotas reais, com IA simulada. Eles não substituem validação da conexão PostgreSQL/TLS de produção nem avaliação pedagógica.

5. Confirmar o teste passando sem enfraquecer as expectativas. Preservar a regressão. Só ampliar a bateria durante a correção se outra área tiver sido afetada ou surgir nova evidência.

## Antes de publicar

- `npm test`: regressões offline, componentes, contratos e TypeScript.
- `npm run build`: build final.
- `npm run test:integration`: servidor com PostgreSQL descartável e identidade Prévia local; nunca estudos pessoais como fixtures. O CI aplica migrações e usa TLS verificado.
- `npm run test:quality-ai`: somente por autorização explícita, com chave configurada e fontes sintéticas. Rever fidelidade à fonte, condições, negações, unidades e referências. Registrar limites e custo quando disponível.
- Conferir no navegador os fluxos alterados, em PC e viewport móvel. Declarar qualquer cenário não verificado.

Não publicar se houver falha relevante ou validação obrigatória pendente. Não confundir push de branch/PR de teste com publicação em produção.

## Incremento aulas, Tutor e histórico

Aulas são sequências guiadas de leitura, resposta e autoavaliação baseadas em snapshots dos cartões. A conclusão não mede domínio nem altera automaticamente a revisão espaçada. Conversas anteriores permanecem na aba Tutor. O novo histórico mostra até 50 aulas/conversas recentes.

O botão Preparar PDF para Tutor extrai texto do arquivo já guardado no baralho, por página, sem chamar IA. Limites: 30 MB, 300 páginas e um milhão de caracteres por PDF. Digitalizações sem camada de texto exigem transcrição; páginas vazias são informadas. A integridade do arquivo e o vínculo ao proprietário são verificados antes de salvar. PDFs originais e índices podem ser refeitos; o backup guarda conversas e aulas, mas os binários continuam separados.

Aplicar a migração 005-learning.sql no ambiente adequado antes de ativar a versão. Backups antigos continuam aceitos; versões antigas do aplicativo não restauram as novas aulas/conversas.
