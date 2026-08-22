# Project Memory

## Core
Disparos manuais em lote (feedback_mensal_link, etc) NUNCA agendar com `agendado_para = now()` — motor envia direto sem revisão. Agendar para janela futura (ex: próximo dia útil 8h) para aparecer como pendente na Visão Geral / Caixa de Saída antes do envio.
