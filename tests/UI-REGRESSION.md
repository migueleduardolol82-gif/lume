# Regressão de interface antes da publicação

Execute pela automação CUA autorizada, em aba própria, usando somente dados sintéticos da identidade Prévia local. Registre esperado, observado, screenshot e versão; um cenário não exercitado não pode ser marcado como aprovado.

1. **CSS servido e layout real (PC e 390 px):** abrir baralho com quatro respostas diferentes; iniciar Quiz de alternativas; conferir quatro botões separados, letras legíveis, foco visível e ausência de sobreposição/rolagem horizontal. Pela leitura do DOM, confirmar que o grupo de opções usa grid e os botões são flex. Recarregar e repetir a abertura. Este cenário detecta o problema já observado em que o dev server entregava CSS antigo e concatenava as alternativas apesar de o arquivo fonte conter as regras.
2. **Quiz escrito:** referência `-1`, resposta `1`; deve exibir diferença. Repetir com `CO`/`Co` e `x²`/`x2`. Uma resposta idêntica deve ser reconhecida como igual à referência. O usuário avalia equivalência de significado.
3. **Alternativas e progressão:** errar primeiro cartão, conferir marcação da escolha e da resposta correta e bloqueio de troca; avançar. Acertar segundo cartão e concluir. Recarregar e conferir exatamente uma revisão por cartão e intervalos esperados (erro: 10 minutos; primeiro acerto: 1 dia).
4. **Materiais:** salvar notas, recarregar, reabrir o baralho e verificar o texto. Abrir criação por IA e conferir material herdado. Rascunhos não salvos não podem ser apresentados como salvos.
5. **Concorrência de notas:** editar rascunho local; outro acesso salva uma versão diferente; sincronizar o primeiro acesso. O rascunho deve permanecer, a tentativa antiga deve retornar conflito e o texto remoto deve continuar salvo. Não exibir aviso sobre cartão para esse conflito. Carregar a versão atual deve ser uma ação explícita.
6. **Qualidade da IA:** fonte sintética com condição científica e negação; gerar três cartões. Perguntas autossuficientes, condição/unidade/negação preservadas, trecho visível e resposta integralmente no trecho. Editar e remover um rascunho antes de salvar. Uma fonte sem fatos retorna zero cartões e encerra o lote.
7. **Limpeza:** remover apenas fixtures cujos IDs/títulos pertençam à sessão de teste. Resetar viewport e fechar abas temporárias. Não tocar nos estudos do usuário.

Testes no viewport não certificam Safari de um iPhone físico. A avaliação pedagógica usa amostras e não substitui conferir o material original.
