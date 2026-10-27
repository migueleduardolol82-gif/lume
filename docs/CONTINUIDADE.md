# Continuidade do desenvolvimento

A base importada é a versão publicada do Lume em25/10/2026, copiada com autorização do proprietário. A fonte de trabalho agora é este repositório. Nunca substituir seu código por cópias antigas.

## Primeiro incremento: verdadeiro/falso

Existe implementação parcial em lib/card-templates.ts, app/card-editor.tsx e app/template-quiz.tsx. lib/release-features.ts bloqueia todos os tipos avançados; lib/content.ts aplica o bloqueio na API e no backup. Implementar liberação por tipo, sem ativar os tipos incompletos.

Cobrir editor, gabarito booleano (incluindo false), estudo/quiz, persistência, concorrência e backup. A construção de distratores no início de quiz de alternativas deve considerar baralhos somente verdadeiro/falso e baralhos mistos, preservando o alinhamento dos cartões.

## Regressões e validação

Para bugs confirmados: reprodução, teste falhando, correção e teste passando. Manter a suíte offline sem chamadas reais de IA. Não enfraquecer testes para obter resultado verde.

Fixtures de escrita: identidade Prévia local, conteúdo sintético, IDs e títulos verificados antes de limpar. Nunca usar estudos pessoais ou produção como fixture. Antes de publicar, testes offline, build e integração aplicável; mudanças de IA exigem amostra real e revisão pedagógica explicitamente autorizadas, pois podem consumir créditos.

Regressões existentes incluem recuperação de rascunhos, lote vazio após geração válida, PDFs100 MB e gravação de relatórios com nomes versionados. Consulte tests/ e scripts/regression.mjs.

## Infraestrutura e limites conhecidos

Next16.3.4, React19.2.6, Neon/PostgreSQL e Vercel. Consultar documentação instalada do Next antes de alterar APIs. O espaço publicado é pessoal e protegido, sem contas individuais.

O Lume usa API OpenAI configurada no servidor; FreeLLMAPI de um agente de programação não troca automaticamente o provedor do produto. Não extrair credenciais de outros aplicativos, nem enviar .env para GitHub ou modelos.

Acesso ao projeto Vercel/deploy funciona pelo conector e navegador autenticado. Algumas leituras de aliases e logs do conector retornam403; reconectar repetidamente não corrigiu. Não desativar autenticação para resolver isso.

## Pendências seguintes

Cloze, múltipla seleção, ordenar, associar e imagens com propriedade validada no servidor; estudo guiado; Tutor lendo PDFs/imagens com citações; backup de binários; avaliação pedagógica em materiais longos e validação no iPhone; mapeamento dos fluxos restantes do Gizmo.

## Verdadeiro/falso — incremento em desenvolvimento

A branch codex/true-false libera somente qa e true_false. Os demais templates seguem bloqueados. O editor salva gabarito booleano; quiz avalia a alternativa escolhida e registra a revisão somente ao avançar. Backup e API rejeitam texto de resposta contraditório com o gabarito.

Regressões: REG-TF-ANSWER-001 cobre backup com resposta inconsistente; REG-TF-STUDY-001 cobre baralho misto, acerto/erro, gravação só ao avançar e falha de gravação sem avanço. Testes de componentes cobrem gabarito false no editor e as quatro combinações entre gabarito e resposta.

Teste integrado adicional: tests/true-false-api.mjs, incluído em npm.cmd run test:integration. Usa exclusivamente fixtures sintéticas na identidade Prévia local e valida persistência, preservação de progresso, conflitos, bloqueio de tipos incompletos e backup/restauração.

Esta etapa não altera o modelo/prompt de geração nem chama IA real. A versão pública permanece a anterior até validação integrada e publicação explícita.

Validação em 27/10/2026: npm.cmd test passou (115 testes de lógica e 29 de componentes); npm.cmd run build passou com TypeScript. A prévia sintética no navegador confirmou criação com gabarito Falso e conferência correta, sem banco ou IA.

A integração real ainda está pendente: o servidor iniciado nesta cópia respondeu 500 no primeiro GET /api/lume, com AggregateError no acesso aos estudos. O teste interrompeu antes de criar fixtures. Não considerar persistência real validada nem publicar esta branch até resolver o acesso e executar npm.cmd run test:integration.
