# Lume

Plataforma de estudo para PC e iPhone, com cartões, quiz, materiais e Tutor.

Produção: https://lume-estudo.vercel.app/ (acesso protegido pela Vercel).

## Executar localmente

1. Instale Node.js 24 e execute `npm.cmd ci`.
2. Copie `.env.example` para `.env.local` e configure os valores somente no seu computador. Não publique esse arquivo.
3. Execute `npm.cmd run db:migrate` no banco destinado ao desenvolvimento, quando necessário.
4. Execute `node scripts/dev.mjs` e abra http://127.0.0.1:5173.

## Funções atuais

- Cartões pergunta/resposta, dicas, tags, quiz escrito e de alternativas.
- Notas com histórico, conflitos de revisão e recuperação de rascunhos.
- Baralhos e subbaralhos; caminho agrupado por tema, até dez cartões por etapa.
- Geração de até 300 cartões com prévia, deduplicação e evidências.
- PDF até100 MB, imagem até3 MB. PDFs de geração são divididos por páginas em partes até45 MB. Uma página indivisível acima do limite não é aceita para geração.
- Biblioteca de até20 arquivos/200 MB, com download e hashes.
- Tutor recupera notas e cartões com citações. PDFs/imagens armazenados não são lidos automaticamente por ele.
- Backup JSON de conteúdo, notas, histórico, progresso e conversas; binários são baixados separadamente.

A quantidade de cartões gerados depende do conteúdo. Evidência presente na fonte não comprova a qualidade pedagógica nem a veracidade do material. Ainda não há paridade total com o Gizmo.

## Validação

`npm.cmd test` executa testes offline de função, componentes e TypeScript, bloqueando rede.
`npm.cmd run build` executa o build final.
Com o servidor local aberto, `npm.cmd run test:integration` usa apenas fixtures sintéticas na identidade Prévia local.
`npm.cmd run test:quality-ai` executa geração e Tutor com API real e pode consumir créditos; não faz parte da suíte offline.
Relatórios locais ficam em `.test-artifacts/reports/`, ignorados no Git.

Na versão publicada em25/10/2026:130 testes offline, integração, build e amostras reais de IA aprovados. Isso não substitui os testes de cada mudança.

## Próximas etapas

Concluir verdadeiro/falso e depois outros tipos avançados, aulas guiadas com retomada, leitura de arquivos pelo Tutor e backup binário. Os tipos incompletos permanecem bloqueados por feature flag.

Chaves e banco são configurados no servidor. Não há chaves, dados pessoais, dependências ou arquivos de estudos incluídos neste repositório. Consulte `docs/CONTINUIDADE.md` para o contexto de desenvolvimento.

Nesta branch, verdadeiro/falso está implementado e validado com PostgreSQL real descartável. O workflow `.github/workflows/quality.yml` verifica testes offline, TypeScript, build e integração em pull requests e em `main`. A integração aplica as migrações em um banco temporário com TLS verificado, sem segredos de produção ou API de IA. A execução 40602058706 aprovou ambas as etapas no commit 03b9363a9b7ca9e38e37d176c495285347e54fd7. Publicação em produção é uma etapa separada.

O incremento `codex/cloze` acrescenta cartões de preencher lacunas (`{{resposta}}`), com uma a oito respostas, editor, recuperação de rascunhos, quiz e gabarito consistente na API/backup. Ele depende da entrega de verdadeiro/falso e tem validação própria no CI antes de publicação.

O incremento `codex/multi-select` acrescenta múltipla seleção: duas a oito opções distintas, gabarito completo e revisão somente após conferência. No editor, use `+ ` para opções corretas e `- ` para incorretas, uma por linha. A geração por IA mantém o formato pergunta/resposta atual.

O incremento `codex/order-items` acrescenta ordenar itens: escreva de dois a oito itens distintos, um por linha, na sequência correta. O quiz embaralha os itens e oferece botões Subir/Descer antes da conferência. Publicação depende da validação do incremento.
