# Banco necessário para uma instalação independente

Inventário estático em 27/09/2026. Fonte: `src/integrations/supabase/types.ts`,
migrações originais e chamadas RPC do aplicativo. Este arquivo **não é um dump
SQL** e não contém dados dos alunos. As migrações `20260101*` são uma
**reimplementação inferida, ainda sem teste em um PostgreSQL real**.

## Cobertura atual

| Objeto | Descrito nas tipagens | Criado pelas migrações do repositório |
| --- | ---: | ---: |
| Tabelas públicas | 65 | 11 originais + 54 inferidas |
| Funções RPC tipadas | 19 | Parcialmente reimplementadas |

As 54 tabelas sem `CREATE TABLE` nas migrações originais, agora cobertas pelo
gerador experimental `scripts/gerar-esquema-inicial.mjs`, são:

`agente_config`, `agente_logs`, `agente_respostas`, `alimento_favoritos`,
`alimentos`, `aluno_agua_log`, `aluno_atividades_dia`,
`aluno_push_subscriptions`, `aluno_refeicoes_log`, `alunos`, `alunos_acesso`,
`body_circumferences`, `community_likes`, `community_posts`, `comunicacoes`,
`daily_checkins`, `dieta_item_substitutos`, `dieta_itens`, `dieta_planos`,
`dieta_refeicoes`, `entregas_dia`, `entregas_dia_log`,
`feedback_agendamentos`, `feedback_envios`, `feedback_templates`,
`financeiro_categorias`, `financeiro_config`, `food_measures`, `foods`,
`formularios`, `fruit_portion_options`, `historico_status`,
`jobs_disparos`, `mensagens_dieta`, `mensagens_log`, `mensagens_template`,
`mensagens_treino`, `mensagens_variantes`,
`pendencias_comunicacao_acoes`, `photo_audit_logs`,
`physical_assessments`, `planos_catalogo`, `pontos_contato`,
`prescricao_modelos`, `prescricoes`, `prompts_ia`, `respostas_rapidas`,
`skinfold_measurements`, `source_reference`, `system_logs`,
`transacoes`, `usuarios_crm`, `workflow_config` e `zapi_webhook_eventos`.

As funções RPC tipadas sem definição nas migrações originais incluem
`buscar_aluno_por_telefone`, `get_aluno_dashboard`, `is_admin`,
`is_crm_user`, `is_equipe_or_admin`, `agendar_jobs_apos_entrega`,
`agendar_ciclos_alunos_ativos`, `recalcular_score_dia` e as funções
administrativas de cron. Consulte o arquivo de tipagens para a lista completa.

As migrações novas cobrem as funções básicas de identidade, busca por telefone,
painel do aluno, calendário e agendamento após D0. **As quatro funções
administrativas de cron (`admin_*_cron_job*`) ainda precisam de um adaptador
para o agendador escolhido.** Elas não podem ser reconstruídas só pelas
assinaturas: a instalação antiga pode ter usado `pg_cron` ou outro serviço.

## O que a tipagem não permite recuperar com fidelidade

Uma propriedade `string` pode ter sido `text`, `uuid`, `date` ou `timestamptz`.
Os tipos de `Insert` não mostram todos os defaults, índices, constraints,
triggers, políticas RLS, permissões, conteúdos iniciais, configuração de
storage e rotinas agendadas. Inventar essas regras pode produzir uma cópia
que compila, mas falha em produção ou expõe dados entre treinadores.

## Caminho para concluir

1. Exportar **somente o esquema** do Supabase original, incluindo tabelas,
   funções, triggers, RLS, índices, grants e buckets. Não incluir registros,
   credenciais nem dados de alunos no GitHub.
2. Revisar o export para retirar IDs, URLs e permissões específicas da MPTEAM.
3. Aplicar em uma instância Supabase nova e testar com dados fictícios.
4. Só então executar as migrações incrementais e validar CRM, aluno,
   formulários, dieta, financeiro, IA, WhatsApp e cron ponta a ponta.

Se não for possível obter o export, estas peças podem ser **reimplementadas**
usando as chamadas do aplicativo como especificação. Isso cria um backend novo
e exige verificar comportamento e segurança de cada módulo; não equivale a
recuperar o banco original.
