# Feedback quinzenal vira mensagem de acompanhamento (sem formulário)

O feedback quinzenal deixa de ter formulário e link. No lugar dele, o aluno recebe no D+15 uma mensagem automática de proximidade, perguntando como está a adesão ao treino e à dieta e se há dificuldades. Nada é gerado automaticamente a partir da resposta do aluno — a equipe lê e responde manualmente pelo WhatsApp. O fluxo do feedback mensal continua exatamente como está e segue sendo o único que atualiza treino e dieta.

## Mensagem sugerida (editável em Configurações → Workflows)

```text
Fala, {nome}! Tudo certo?

Passando pra saber como estão sendo esses dias:

- Como está a adesão ao treino?
- E à dieta, está conseguindo seguir?
- Tem aparecido alguma dificuldade ou dúvida?

Me conta por aqui mesmo, em texto ou áudio. Isso ajuda muito a gente a te acompanhar de perto até o feedback mensal.
```

## O que muda

1. **Mensagem no D+15**: o disparo quinzenal passa a enviar esse texto direto ao WhatsApp do aluno, sem link de formulário.
2. **Sem formulário quinzenal**: nenhum novo formulário quinzenal é criado, e o link público de feedback quinzenal deixa de aceitar novas respostas.
3. **Sem lembretes e sem devolutiva IA no quinzenal**: acaba o lembrete de "formulário pendente" e a resposta automática por IA para o quinzenal. Ambos continuam ativos no mensal.
4. **Histórico preservado**: as respostas quinzenais já existentes continuam visíveis no perfil do aluno, apenas em leitura.
5. **Telas ajustadas**: nas páginas de Feedbacks, Caixa de Saída e Visão Geral, o quinzenal aparece como "Check-in quinzenal (mensagem)" e sai das listas de pendências de formulário.

## Detalhes técnicos

- `src/server/motor-core.server.ts`: no case `feedback_quinzenal_link`, trocar o template `MSG_LINK_QUINZENAL` por um novo `MSG_CHECKIN_QUINZENAL` (apenas `{nome}`, sem `{link}`); encerrar jobs `feedback_quinzenal_resposta` como não aplicáveis.
- `src/server/processar-jobs-feedback-core.server.ts`: remover `feedback_quinzenal_resposta` da lista de tipos processados.
- `src/server/feedback-lembretes-core.server.ts` e `feedback-lembretes.functions.ts`: restringir a busca de formulários pendentes/devolutivas a `feedback_mensal`; o quinzenal deixa de depender de formulário e passa a ser mensagem simples disparada pelo motor.
- Migração: atualizar `trg_pos_resposta_feedback` para tratar apenas `feedback_mensal`; inserir a chave `MSG_CHECKIN_QUINZENAL` em `workflow_config` com o texto acima; desativar agendamentos quinzenais remanescentes em `feedback_agendamentos` e cancelar jobs `feedback_quinzenal_resposta` / `feedback_link_lembrete` de formulários quinzenais ainda pendentes.
- `src/routes/feedback-quinzenal.tsx` e `PublicFormularioPublico`: a página passa a exibir aviso de que o feedback quinzenal agora é feito por WhatsApp (sem envio de respostas).
- UI: `_app.feedbacks.tsx`, `DisparosTab.tsx`, `FeedbacksSemRespostaCard.tsx`, `WorkflowSection.tsx` — renomear rótulos, trocar o campo de template do quinzenal e remover o quinzenal das listas de formulários/links pendentes, mantendo o histórico no perfil do aluno.