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

## Diagnóstico e regressões da API — 27/10/2026

A consulta mínima SELECT 1 ao banco falhou com AggregateError/EACCES no syscall connect. É uma restrição de conexão deste ambiente, anterior às consultas da aplicação. Nenhuma credencial foi exibida e a verificação TLS foi preservada. Não alterar o código de persistência para contornar essa restrição.

A suíte offline agora inclui sete testes da rota real compilada com banco e identidade simulados, sem rede nem IA. REG-TF-EDIT-002 detecta edição legada que omite details e contradiz o gabarito salvo; REG-TF-IMPORT-002 detecta importação legada que omite details na coluna de destino. As duas regressões foram demonstradas falhando numa cópia compilada sem as correções e passando no código atual. Esses testes não substituem a integração com PostgreSQL.

Total local aprovado: 151 testes (115 de lógica, 29 de componentes e sete contratos da API), incluindo TypeScript. O build da alteração funcional passou na etapa anterior. O workflow .github/workflows/quality.yml executa regressão e build em pull requests e mudanças em main, sem segredos ou chamadas de IA. Confirmar a execução no GitHub após envio; testes integrados com banco continuam necessários antes do deploy.

## Integração real concluída — 27/10/2026

A pendência de PostgreSQL desta etapa foi resolvida executando a suíte no GitHub Actions contra um serviço PostgreSQL 16 descartável. O cliente manteve sslmode=verify-full com certificado do serviço gerado no próprio job; pg_stat_ssl confirmou TLS. Nenhuma conexão ou credencial de produção foi usada. O bloqueio EACCES do computador permanece uma restrição local, sem impedir esta validação em ambiente isolado.

Commit funcional validado: 03b9363a9b7ca9e38e37d176c495285347e54fd7. Execução https://github.com/migueleduardolol82-gif/lume/actions/runs/40602058706 : quality e integration concluídos com sucesso. Passaram 151 testes offline, TypeScript, build, quatro migrações e os oito arquivos da suíte integrada. Os logs confirmam verdadeiro/falso persistido, progresso preservado na edição, conflitos/gabaritos inválidos rejeitados e backup/restauração de false e true. As fixtures foram removidas pelos testes e o serviço descartado ao final do job.

scripts/ci-integration.mjs inicia exclusivamente o banco localhost/lume_test do CI em Linux, recusa chave de IA e executa as migrações e a prévia local, encerrando o processo que iniciou. Não usa scripts/dev.mjs nem o manifesto de origem. O workflow passa a repetir a integração automaticamente em alterações futuras. A etapa verdadeiro/falso está apta à revisão; não houve merge ou promoção para produção nesta etapa.
