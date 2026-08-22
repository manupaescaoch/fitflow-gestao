# Auditoria de envios automáticos + painel "Mensagens Pendentes"

## O que a auditoria encontrou

Consultas feitas agora no banco:

- **75 alunos ativos nunca tiveram um agendamento de feedback mensal** (todos com data de início preenchida, alguns desde julho/2025).
- Distribuição dos alunos ativos por quantidade de feedbacks mensais já agendados: 75 com zero, 97 com apenas um, 49 com dois, 16 com três, 5 com quatro. Ou seja, a maioria parou no primeiro ciclo.
- Motivos gravados nos jobs dos últimos 60 dias: `ignorado_atraso_reativacao` (59), `envio_manual_whatsapp` (45), aluno cancelado/inativo (38), `cancelado_pelo_usuario_dispatch_manual` (106), 2 falhas de chave da IA.
- Fila e cron funcionando: 474 mensagens enviadas nos últimos 30 dias, 23 pendentes.

**Causa raiz:** o próximo ciclo de mensagens só é agendado em cadeia — o aluno responde o feedback mensal, isso cria uma entrega do dia, a equipe marca dieta/treino como entregues, e só então o sistema agenda o próximo check-in quinzenal e o próximo feedback mensal. Se o aluno não responde, ou a equipe não marca a entrega, ou o aluno entrou no sistema por outro caminho (importação, ativação manual), a corrente quebra e **ele nunca mais recebe nada**. Não é falha de integração nem de fila: é ausência de agendamento.

## Correção definitiva: agenda por calendário

Uma rotina diária passa por **todos os alunos ativos** e garante o agendamento independentemente de entregas e respostas:

- **Check-in quinzenal**: a cada 15 dias contados a partir da data de início do aluno.
- **Feedback mensal**: a cada 30 dias contados a partir da data de início.
- Só agenda se não houver um job igual pendente e se a última mensagem daquele tipo tiver mais de 10 dias (quinzenal) / 20 dias (mensal), evitando duplicidade.
- Respeita a trava de fim de semana e a janela comercial já existentes.
- Alunos cancelados, em anamnese ou em produção são ignorados.
- Na primeira execução, os 75 alunos descobertos entram na fila normalmente (com intervalo entre envios já configurado no motor).

A cadeia atual continua existindo, mas deixa de ser o único caminho.

## Painel "Mensagens Pendentes" na página inicial

Novo painel permanente na Visão Geral, listando **apenas alunos com plano ativo** que deveriam ter recebido uma comunicação e não receberam (job atrasado, com erro, ou ciclo vencido sem envio).

Colunas por registro: nome, telefone com botão de WhatsApp, unidade (usa a modalidade: MP Team / MP Elite / MP Presencial), plano, status do plano, tipo da mensagem (feedback mensal ou acompanhamento quinzenal), data prevista, atraso em dias, motivo do erro quando houver, botão **Registrar envio manual** e status do atendimento (Pendente / Enviado manualmente / Resolvido).

Indicadores no topo: total de pendências, feedbacks mensais pendentes, quinzenais pendentes, envios manuais feitos hoje, e pendências por unidade.

Filtros: unidade, tipo de mensagem, status, período e responsável pelo envio manual.

Regras: quando o envio automático acontece com sucesso, o registro sai do painel sozinho. O envio manual registra usuário responsável, data/hora e observação opcional, e fica gravado em histórico permanente para auditoria.

## Detalhes técnicos

**Banco**
- Nova tabela `pendencias_comunicacao_acoes` (aluno, tipo de mensagem, data prevista, ação, usuário, observação, timestamps) com grants, RLS para equipe/admin e índices.
- Função `agendar_ciclos_alunos_ativos()` (security definer) que faz o agendamento por calendário descrito acima, inserindo em `jobs_disparos`.
- Cron diário chamando essa função (07:10 BRT, dias úteis).

**Backend**
- `src/server/pendencias.functions.ts`: `listPendencias` (junta alunos ativos, jobs atrasados/com erro e ciclos vencidos, aplica filtros), `registrarEnvioManual`, `listAcoesManuais` para o histórico.
- `src/server/agenda-ciclos.server.ts` + rota `src/routes/api/public/hooks/agenda-ciclos.ts` como alternativa acionável manualmente, com autenticação de cron e trava de fim de semana.

**Frontend**
- `src/components/visao-geral/MensagensPendentesPanel.tsx` com cards de indicadores, barra de filtros e tabela/lista responsiva.
- Modal `RegistrarEnvioManualModal.tsx` com observação opcional.
- Montagem do painel em `src/routes/_app.visao-geral.tsx`.

**Limpeza**
- Reagendar os 75 alunos ativos sem histórico na primeira execução da rotina, escalonados para não disparar tudo de uma vez.
