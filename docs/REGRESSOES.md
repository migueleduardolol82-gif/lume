# Regressões confirmadas neste incremento

| ID | Reprodução e resultado incorreto | Teste focado | Correção |
|---|---|---|---|
| REG-SEARCH-001 | Baralho Revisão de investimento; buscar `  revisao  ` ocultava o resultado. Teste falhou com 0 em vez de 1. | search-regression-ui.mjs | Normalizar acentos e espaços nas bordas na busca de baralhos. |
| REG-HISTORY-RACE-001 | Abrir Aula A e depois B; a resposta de A termina por último e substituía B. | learning-ui.mjs | Descartar respostas de aberturas anteriores por número de versão. |
| REG-CHAT-RETRY-001 | Reenviar a mesma pergunta confirmada com o mesmo evento retornava conflito. Teste falhou com 409 em vez de 200. | learning-api-offline.mjs | Reconhecer o evento salvo e devolver o resultado sem nova chamada de IA. |
| REG-PDF-PATH-001 | A configuração de fontes/CMaps usava barra invertida ao final no Windows; PDF.js rejeitava o caminho antes de extrair o texto. | pdf-text.ts | Usar caminhos locais com barras compatíveis e barra final explícita. |

Os quatro testes foram executados falhando antes da correção e passando depois. A primeira falha existia na base; as demais foram detectadas durante a implementação, antes da publicação. Evidência de terminal foi preservada no relatório desta entrega. Isso não significa que toda a plataforma está livre de bugs.
