# Central de acompanhamento sempre visível

## Objetivo
O bloco no topo da Visão Geral deve aparecer imediatamente, sem a tela de "Carregando central de acompanhamento...", e permanecer sempre presente na página.

## O que muda
1. Remover o estado de carregamento que substitui o bloco inteiro. O cartão passa a ser desenhado de imediato, com título "Central de acompanhamento" e contagem.
2. Enquanto os dados chegam, a lista mostra apenas linhas cinzas de espaço reservado (esqueleto), sem trocar o bloco por uma mensagem de carregando.
3. O cartão nunca desaparece: sem pendências, mostra a mensagem "Nenhum follow-up ou feedback pendente agora" dentro do mesmo cartão, com o mesmo cabeçalho.
4. Atualizações em segundo plano (depois de enviar ou marcar como enviado) não voltam a mostrar carregamento; no máximo um indicador discreto no cabeçalho.

## Detalhes técnicos
- Arquivo: `src/components/visao-geral/FeedbacksSemRespostaCard.tsx`.
- Retirar o early-return de `loading` (linhas ~372-380) e unificar os estados vazio/carregando dentro do mesmo contêiner do cartão.
- Manter a mesma estrutura de dados e chamadas atuais (nenhuma mudança de servidor, banco ou WhatsApp).
