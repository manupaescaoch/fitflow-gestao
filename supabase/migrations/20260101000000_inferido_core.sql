-- ESQUEMA INFERIDO das tipagens geradas; conferir antes de aplicar.

-- Instância nova apenas. Nunca aplicar sobre o banco original.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE TYPE public."aluno_modalidade" AS ENUM ('mpteam', 'mp_elite', 'mp_presencial');

CREATE TYPE public."aluno_servico" AS ENUM ('treino_e_dieta', 'dieta', 'treino');

CREATE TYPE public."aluno_status" AS ENUM ('aguardando_anamnese', 'anamnese_recebida', 'em_producao', 'ativo', 'aguardando_renovacao', 'renovado', 'cancelado');

CREATE TYPE public."app_role" AS ENUM ('admin', 'equipe', 'visualizador', 'consultor');

CREATE TYPE public."envio_status" AS ENUM ('enviado', 'erro', 'pendente', 'descartado');

CREATE TYPE public."formulario_tipo" AS ENUM ('anamnese', 'feedback_quinzenal', 'check_shape', 'feedback_mensal');

CREATE TYPE public."job_tipo" AS ENUM ('boas_vindas', 'link_anamnese', 'd1', 'd7', 'd15_formulario', 'd21', 'd27', 'd29', 'd30', 'd31', 'ia_feedback_quinzenal', 'ia_check_shape', 'resumo_diario', 'anamnese_confirmacao', 'followup_d7', 'feedback_quinzenal_link', 'followup_d21', 'feedback_mensal_link', 'feedback_quinzenal_resposta', 'feedback_mensal_resposta', 'pos_feedback_mensal', 'aniversario', 'feedback_link_lembrete', 'pos_entrega_d1', 'push_lembrete', 'novo_aluno_admin');

CREATE TYPE public."prompt_tipo" AS ENUM ('feedback_quinzenal', 'check_shape', 'treino', 'anamnese', 'feedback_mensal', 'followup_d7', 'followup_d21', 'estrategia_treino', 'estrategia_nutricional', 'check_shape_mensal', 'anamnese_recebida', 'feedback_quinzenal_lembrete');

CREATE TYPE public."template_modalidade" AS ENUM ('mpteam', 'mp_elite', 'mp_presencial', 'todas');

CREATE TABLE public."agente_config" (
  "ativo" boolean DEFAULT false NOT NULL,
  "atualizado_em" timestamptz DEFAULT now() NOT NULL,
  "atualizado_por" uuid,
  "canais" text[] DEFAULT '{}'::text[] NOT NULL,
  "dias_semana" numeric[] DEFAULT '{}'::numeric[] NOT NULL,
  "grupo_interno_nome" text,
  "grupo_interno_ultimo_envio_em" timestamptz,
  "grupo_interno_zapi_id" text,
  "hora_fim" numeric DEFAULT 0 NOT NULL,
  "hora_inicio" numeric DEFAULT 0 NOT NULL,
  "id" boolean DEFAULT false NOT NULL PRIMARY KEY,
  "modo_envio" text,
  "modo_resposta" text,
  "nome" text,
  "prompt_principal" text
);

ALTER TABLE public."agente_config" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public."agente_config" TO authenticated;

GRANT ALL ON public."agente_config" TO service_role;

CREATE TABLE public."agente_logs" (
  "aluno_id" uuid,
  "canal" text,
  "criado_em" timestamptz DEFAULT now() NOT NULL,
  "data_referencia" date,
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "motivo" text,
  "pergunta" text,
  "resposta" text,
  "tipo" text NOT NULL
);

ALTER TABLE public."agente_logs" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public."agente_logs" TO authenticated;

GRANT ALL ON public."agente_logs" TO service_role;

CREATE TABLE public."agente_respostas" (
  "ativo" boolean DEFAULT false NOT NULL,
  "atualizado_em" timestamptz DEFAULT now() NOT NULL,
  "atualizado_por" uuid,
  "categoria" text NOT NULL,
  "criado_em" timestamptz DEFAULT now() NOT NULL,
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "nome" text NOT NULL,
  "ordem" numeric DEFAULT 0 NOT NULL,
  "publico_alvo" text,
  "quando_usar" text,
  "texto" text
);

ALTER TABLE public."agente_respostas" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public."agente_respostas" TO authenticated;

GRANT ALL ON public."agente_respostas" TO service_role;

CREATE TABLE public."alimento_favoritos" (
  "criado_em" timestamptz DEFAULT now() NOT NULL,
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "nome" text NOT NULL,
  "principal" jsonb NOT NULL,
  "substitutos" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "user_id" uuid NOT NULL
);

ALTER TABLE public."alimento_favoritos" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public."alimento_favoritos" TO authenticated;

GRANT ALL ON public."alimento_favoritos" TO service_role;

CREATE TABLE public."alimentos" (
  "aliases" text[] DEFAULT '{}'::text[] NOT NULL,
  "ativo" boolean DEFAULT false NOT NULL,
  "categoria" text,
  "cho_100" numeric DEFAULT 0 NOT NULL,
  "criado_em" timestamptz DEFAULT now() NOT NULL,
  "criado_por" uuid,
  "fibra_100" numeric DEFAULT 0 NOT NULL,
  "fonte" text,
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "kcal_100" numeric DEFAULT 0 NOT NULL,
  "lip_100" numeric DEFAULT 0 NOT NULL,
  "marca" text,
  "nome" text NOT NULL,
  "ptn_100" numeric DEFAULT 0 NOT NULL,
  "qtd_padrao" numeric DEFAULT 0 NOT NULL,
  "regiao" text,
  "restricoes" text[] DEFAULT '{}'::text[] NOT NULL,
  "subcategoria" text,
  "tags" text[] DEFAULT '{}'::text[] NOT NULL,
  "unidade_padrao" text
);

ALTER TABLE public."alimentos" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public."alimentos" TO authenticated;

GRANT ALL ON public."alimentos" TO service_role;

CREATE TABLE public."aluno_agua_log" (
  "aluno_id" uuid NOT NULL,
  "criado_em" timestamptz DEFAULT now() NOT NULL,
  "data_referencia" date,
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "ml" numeric NOT NULL
);

ALTER TABLE public."aluno_agua_log" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public."aluno_agua_log" TO authenticated;

GRANT ALL ON public."aluno_agua_log" TO service_role;

CREATE TABLE public."aluno_atividades_dia" (
  "aluno_id" uuid NOT NULL,
  "atualizado_em" timestamptz DEFAULT now() NOT NULL,
  "concluido" boolean DEFAULT false NOT NULL,
  "criado_em" timestamptz DEFAULT now() NOT NULL,
  "data_referencia" date,
  "duracao_min" numeric,
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "tipo" text NOT NULL
);

ALTER TABLE public."aluno_atividades_dia" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public."aluno_atividades_dia" TO authenticated;

GRANT ALL ON public."aluno_atividades_dia" TO service_role;

CREATE TABLE public."aluno_push_subscriptions" (
  "aluno_id" uuid NOT NULL,
  "atualizado_em" timestamptz DEFAULT now() NOT NULL,
  "auth" text NOT NULL,
  "criado_em" timestamptz DEFAULT now() NOT NULL,
  "endpoint" text NOT NULL,
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "p256dh" text NOT NULL,
  "user_agent" text
);

ALTER TABLE public."aluno_push_subscriptions" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public."aluno_push_subscriptions" TO authenticated;

GRANT ALL ON public."aluno_push_subscriptions" TO service_role;

CREATE TABLE public."aluno_refeicoes_log" (
  "aluno_id" uuid NOT NULL,
  "data_referencia" date,
  "feito_em" timestamptz DEFAULT now() NOT NULL,
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "refeicao_id" uuid,
  "refeicao_nome" text
);

ALTER TABLE public."aluno_refeicoes_log" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public."aluno_refeicoes_log" TO authenticated;

GRANT ALL ON public."aluno_refeicoes_log" TO service_role;

CREATE TABLE public."alunos" (
  "altura_cm" numeric,
  "atualizado_em" timestamptz DEFAULT now() NOT NULL,
  "cpf" text,
  "criado_em" timestamptz DEFAULT now() NOT NULL,
  "data_anamnese" timestamptz,
  "data_compra" timestamptz,
  "data_d0" timestamptz,
  "data_expiracao" timestamptz,
  "data_nascimento" date,
  "email" text,
  "foto_url" text,
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "modalidade" public.aluno_modalidade,
  "nome" text NOT NULL,
  "observacoes" text,
  "origem" text,
  "peso_kg" numeric,
  "plano" text,
  "prazo_dias" numeric DEFAULT 0 NOT NULL,
  "renovado" boolean DEFAULT false NOT NULL,
  "servico_contratado" public.aluno_servico,
  "sexo" text,
  "status" public.aluno_status,
  "total_renovacoes" numeric DEFAULT 0 NOT NULL,
  "username" text,
  "valor_plano" numeric,
  "whatsapp" text NOT NULL
);

ALTER TABLE public."alunos" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public."alunos" TO authenticated;

GRANT ALL ON public."alunos" TO service_role;

CREATE TABLE public."alunos_acesso" (
  "aluno_id" uuid NOT NULL,
  "atualizado_em" timestamptz DEFAULT now() NOT NULL,
  "criado_em" timestamptz DEFAULT now() NOT NULL,
  "deve_trocar_senha" boolean DEFAULT false NOT NULL,
  "senha_hash" text NOT NULL,
  "ultimo_login_em" timestamptz,
  CONSTRAINT "alunos_acesso_pkey" PRIMARY KEY ("aluno_id")
);

ALTER TABLE public."alunos_acesso" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public."alunos_acesso" TO authenticated;

GRANT ALL ON public."alunos_acesso" TO service_role;

CREATE TABLE public."body_circumferences" (
  "abdomen" numeric,
  "assessment_id" uuid NOT NULL,
  "contracted_left_arm" numeric,
  "contracted_right_arm" numeric,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "hip" numeric,
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "left_calf" numeric,
  "left_thigh" numeric,
  "relaxed_left_arm" numeric,
  "relaxed_right_arm" numeric,
  "right_calf" numeric,
  "right_thigh" numeric,
  "shoulder" numeric,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "waist" numeric
);

ALTER TABLE public."body_circumferences" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public."body_circumferences" TO authenticated;

GRANT ALL ON public."body_circumferences" TO service_role;

CREATE TABLE public."community_likes" (
  "aluno_id" uuid NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "post_id" uuid NOT NULL
);

ALTER TABLE public."community_likes" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public."community_likes" TO authenticated;

GRANT ALL ON public."community_likes" TO service_role;

CREATE TABLE public."community_posts" (
  "aluno_id" uuid NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "foto_url" text NOT NULL,
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "legenda" text
);

ALTER TABLE public."community_posts" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public."community_posts" TO authenticated;

GRANT ALL ON public."community_posts" TO service_role;

CREATE TABLE public."comunicacoes" (
  "aluno_id" uuid NOT NULL,
  "canal" text,
  "criado_em" timestamptz DEFAULT now() NOT NULL,
  "enviado_em" timestamptz DEFAULT now() NOT NULL,
  "gatilho" text NOT NULL,
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "mensagem" text NOT NULL,
  "status" text
);

ALTER TABLE public."comunicacoes" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public."comunicacoes" TO authenticated;

GRANT ALL ON public."comunicacoes" TO service_role;

CREATE TABLE public."daily_checkins" (
  "alimentacao_fim_semana" text,
  "aluno_id" uuid NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "data_checkin" date,
  "energia" numeric,
  "exagero_fim_semana" text,
  "foco_semana" text,
  "humor" numeric,
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "qualidade_sono" numeric,
  "score_gerado" numeric DEFAULT 0 NOT NULL,
  "sono_horas" numeric,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public."daily_checkins" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public."daily_checkins" TO authenticated;

GRANT ALL ON public."daily_checkins" TO service_role;

CREATE TABLE public."dieta_item_substitutos" (
  "alimento_id" uuid,
  "cho" numeric DEFAULT 0 NOT NULL,
  "criado_em" timestamptz DEFAULT now() NOT NULL,
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "item_id" uuid NOT NULL,
  "kcal" numeric DEFAULT 0 NOT NULL,
  "lip" numeric DEFAULT 0 NOT NULL,
  "nome_custom" text,
  "ordem" numeric DEFAULT 0 NOT NULL,
  "ptn" numeric DEFAULT 0 NOT NULL,
  "quantidade" numeric DEFAULT 0 NOT NULL,
  "unidade" text
);

ALTER TABLE public."dieta_item_substitutos" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public."dieta_item_substitutos" TO authenticated;

GRANT ALL ON public."dieta_item_substitutos" TO service_role;

CREATE TABLE public."dieta_itens" (
  "alimento_id" uuid,
  "cho" numeric DEFAULT 0 NOT NULL,
  "criado_em" timestamptz DEFAULT now() NOT NULL,
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "kcal" numeric DEFAULT 0 NOT NULL,
  "lip" numeric DEFAULT 0 NOT NULL,
  "nome_custom" text,
  "ordem" numeric DEFAULT 0 NOT NULL,
  "ptn" numeric DEFAULT 0 NOT NULL,
  "quantidade" numeric DEFAULT 0 NOT NULL,
  "refeicao_id" uuid NOT NULL,
  "unidade" text
);

ALTER TABLE public."dieta_itens" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public."dieta_itens" TO authenticated;

GRANT ALL ON public."dieta_itens" TO service_role;

CREATE TABLE public."dieta_planos" (
  "aluno_id" uuid,
  "atualizado_em" timestamptz DEFAULT now() NOT NULL,
  "cho_g_kg" numeric,
  "criado_em" timestamptz DEFAULT now() NOT NULL,
  "criado_por" uuid,
  "descricao" text,
  "dias_semana" text[] DEFAULT '{}'::text[] NOT NULL,
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "lip_g_kg" numeric,
  "meta_kcal" numeric,
  "nome" text,
  "observacoes" text,
  "peso_referencia" numeric,
  "ptn_g_kg" numeric,
  "status" text,
  "template" boolean DEFAULT false NOT NULL
);

ALTER TABLE public."dieta_planos" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public."dieta_planos" TO authenticated;

GRANT ALL ON public."dieta_planos" TO service_role;

CREATE TABLE public."dieta_refeicoes" (
  "criado_em" timestamptz DEFAULT now() NOT NULL,
  "horario" text,
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "nome" text NOT NULL,
  "observacoes" text,
  "ordem" numeric DEFAULT 0 NOT NULL,
  "plano_id" uuid NOT NULL
);

ALTER TABLE public."dieta_refeicoes" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public."dieta_refeicoes" TO authenticated;

GRANT ALL ON public."dieta_refeicoes" TO service_role;

CREATE TABLE public."entregas_dia" (
  "aluno_id" uuid NOT NULL,
  "criado_em" timestamptz DEFAULT now() NOT NULL,
  "d0_confirmado" boolean DEFAULT false NOT NULL,
  "d0_confirmado_em" timestamptz,
  "d0_confirmado_por" uuid,
  "data_referencia" date NOT NULL,
  "dieta_entregue" boolean DEFAULT false NOT NULL,
  "dieta_entregue_em" timestamptz,
  "dieta_entregue_por" uuid,
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "treino_entregue" boolean DEFAULT false NOT NULL,
  "treino_entregue_em" timestamptz,
  "treino_entregue_por" uuid
);

ALTER TABLE public."entregas_dia" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public."entregas_dia" TO authenticated;

GRANT ALL ON public."entregas_dia" TO service_role;

CREATE TABLE public."entregas_dia_log" (
  "aluno_id" uuid,
  "aluno_nome" text,
  "criado_em" timestamptz DEFAULT now() NOT NULL,
  "data_base" timestamptz,
  "data_referencia" date,
  "detalhes" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "origem" text NOT NULL,
  "resultado" text NOT NULL,
  "tipo_evento" text NOT NULL
);

ALTER TABLE public."entregas_dia_log" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public."entregas_dia_log" TO authenticated;

GRANT ALL ON public."entregas_dia_log" TO service_role;

CREATE TABLE public."feedback_agendamentos" (
  "aluno_id" uuid NOT NULL,
  "ativo" boolean DEFAULT false NOT NULL,
  "atualizado_em" timestamptz DEFAULT now() NOT NULL,
  "criado_em" timestamptz DEFAULT now() NOT NULL,
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "intervalo_dias" numeric NOT NULL,
  "periodicidade" text NOT NULL,
  "proximo_envio_em" timestamptz,
  "template_id" uuid NOT NULL,
  "ultimo_envio_em" timestamptz
);

ALTER TABLE public."feedback_agendamentos" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public."feedback_agendamentos" TO authenticated;

GRANT ALL ON public."feedback_agendamentos" TO service_role;

CREATE TABLE public."feedback_envios" (
  "aluno_id" uuid NOT NULL,
  "enviado_em" timestamptz DEFAULT now() NOT NULL,
  "expira_em" timestamptz,
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "respondido_em" timestamptz,
  "respostas" jsonb,
  "status" text,
  "template_id" uuid NOT NULL,
  "token" text
);

ALTER TABLE public."feedback_envios" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public."feedback_envios" TO authenticated;

GRANT ALL ON public."feedback_envios" TO service_role;

CREATE TABLE public."feedback_templates" (
  "ativo" boolean DEFAULT false NOT NULL,
  "atualizado_em" timestamptz DEFAULT now() NOT NULL,
  "criado_em" timestamptz DEFAULT now() NOT NULL,
  "descricao" text,
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "nome" text NOT NULL,
  "perguntas" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "tipo" text
);

ALTER TABLE public."feedback_templates" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public."feedback_templates" TO authenticated;

GRANT ALL ON public."feedback_templates" TO service_role;

CREATE TABLE public."financeiro_categorias" (
  "cor" text,
  "criado_em" timestamptz DEFAULT now() NOT NULL,
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "nome" text NOT NULL,
  "tipo" text NOT NULL
);

ALTER TABLE public."financeiro_categorias" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public."financeiro_categorias" TO authenticated;

GRANT ALL ON public."financeiro_categorias" TO service_role;

CREATE TABLE public."financeiro_config" (
  "atualizado_em" timestamptz DEFAULT now() NOT NULL,
  "dias_alerta_vencimento" numeric DEFAULT 0 NOT NULL,
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "juros_pct" numeric DEFAULT 0 NOT NULL,
  "mensagem_cobranca" text,
  "multa_pct" numeric DEFAULT 0 NOT NULL
);

ALTER TABLE public."financeiro_config" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public."financeiro_config" TO authenticated;

GRANT ALL ON public."financeiro_config" TO service_role;

CREATE TABLE public."food_measures" (
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "display_dropdown" text,
  "display_prescription" text,
  "food_id" uuid NOT NULL,
  "grams_equivalent" numeric DEFAULT 0 NOT NULL,
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "is_default" boolean DEFAULT false NOT NULL,
  "measure_name" text NOT NULL,
  "measure_type" text,
  "observation" text,
  "sort_order" numeric DEFAULT 0 NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public."food_measures" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public."food_measures" TO authenticated;

GRANT ALL ON public."food_measures" TO service_role;

CREATE TABLE public."foods" (
  "carbs_100g" numeric DEFAULT 0 NOT NULL,
  "category" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "created_by_user" boolean DEFAULT false NOT NULL,
  "fat_100g" numeric DEFAULT 0 NOT NULL,
  "fiber_100g" numeric DEFAULT 0 NOT NULL,
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "is_fruit" boolean DEFAULT false NOT NULL,
  "kcal_100g" numeric DEFAULT 0 NOT NULL,
  "name" text NOT NULL,
  "name_normalized" text,
  "original_subcategory" text,
  "protein_100g" numeric DEFAULT 0 NOT NULL,
  "source" text,
  "source_document" text,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public."foods" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public."foods" TO authenticated;

GRANT ALL ON public."foods" TO service_role;

CREATE TABLE public."formularios" (
  "aluno_id" uuid,
  "confirmado_em" timestamptz,
  "confirmado_equipe" boolean DEFAULT false NOT NULL,
  "confirmado_por" uuid,
  "criado_em" timestamptz DEFAULT now() NOT NULL,
  "dados_resposta" jsonb,
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "link_publico" text,
  "origem" text,
  "recebido_em" timestamptz DEFAULT now() NOT NULL,
  "respondido" boolean DEFAULT false NOT NULL,
  "respondido_em" timestamptz,
  "tipo" public.formulario_tipo NOT NULL,
  "token" text
);

ALTER TABLE public."formularios" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public."formularios" TO authenticated;

GRANT ALL ON public."formularios" TO service_role;

CREATE TABLE public."fruit_portion_options" (
  "active" boolean DEFAULT false NOT NULL,
  "food_name" text NOT NULL,
  "grams" numeric NOT NULL,
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "reference_kcal" numeric DEFAULT 0 NOT NULL,
  "sort_order" numeric DEFAULT 0 NOT NULL
);

ALTER TABLE public."fruit_portion_options" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public."fruit_portion_options" TO authenticated;

GRANT ALL ON public."fruit_portion_options" TO service_role;

CREATE TABLE public."historico_status" (
  "alterado_por" uuid,
  "aluno_id" uuid,
  "criado_em" timestamptz DEFAULT now() NOT NULL,
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "status_de" text,
  "status_para" text
);

ALTER TABLE public."historico_status" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public."historico_status" TO authenticated;

GRANT ALL ON public."historico_status" TO service_role;

CREATE TABLE public."jobs_disparos" (
  "agendado_para" timestamptz NOT NULL,
  "aluno_id" uuid,
  "criado_em" timestamptz DEFAULT now() NOT NULL,
  "erro" text,
  "executado" boolean DEFAULT false NOT NULL,
  "executado_em" timestamptz,
  "formulario_id" uuid,
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "payload" jsonb,
  "tentativas" numeric DEFAULT 0 NOT NULL,
  "tipo" public.job_tipo NOT NULL
);

ALTER TABLE public."jobs_disparos" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public."jobs_disparos" TO authenticated;

GRANT ALL ON public."jobs_disparos" TO service_role;

CREATE TABLE public."mensagens_dieta" (
  "ajustes_realizados" text NOT NULL,
  "aluno_id" uuid,
  "criado_em" timestamptz DEFAULT now() NOT NULL,
  "criado_por" uuid,
  "dificuldades" text,
  "enviado_whatsapp_em" timestamptz,
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "medidas_otimizacao" text NOT NULL,
  "mensagem_gerada" text
);

ALTER TABLE public."mensagens_dieta" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public."mensagens_dieta" TO authenticated;

GRANT ALL ON public."mensagens_dieta" TO service_role;

CREATE TABLE public."mensagens_log" (
  "aluno_id" uuid,
  "enviado_em" timestamptz DEFAULT now() NOT NULL,
  "erro_detalhe" text,
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "mensagem_enviada" text,
  "status_envio" public.envio_status,
  "tipo_job" text,
  "whatsapp_destino" text
);

ALTER TABLE public."mensagens_log" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public."mensagens_log" TO authenticated;

GRANT ALL ON public."mensagens_log" TO service_role;

CREATE TABLE public."mensagens_template" (
  "ativo" boolean DEFAULT false NOT NULL,
  "atualizado_em" timestamptz DEFAULT now() NOT NULL,
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "modalidade" public.template_modalidade NOT NULL,
  "texto" text NOT NULL,
  "tipo_job" public.job_tipo NOT NULL
);

ALTER TABLE public."mensagens_template" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public."mensagens_template" TO authenticated;

GRANT ALL ON public."mensagens_template" TO service_role;

CREATE TABLE public."mensagens_treino" (
  "ajustes_realizados" text NOT NULL,
  "aluno_id" uuid,
  "criado_em" timestamptz DEFAULT now() NOT NULL,
  "criado_por" uuid,
  "dificuldades" text,
  "enviado_whatsapp_em" timestamptz,
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "medidas_otimizacao" text NOT NULL,
  "mensagem_gerada" text
);

ALTER TABLE public."mensagens_treino" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public."mensagens_treino" TO authenticated;

GRANT ALL ON public."mensagens_treino" TO service_role;

CREATE TABLE public."mensagens_variantes" (
  "ativo" boolean DEFAULT false NOT NULL,
  "atualizado_em" timestamptz DEFAULT now() NOT NULL,
  "atualizado_por" uuid,
  "chave" text NOT NULL,
  "criado_em" timestamptz DEFAULT now() NOT NULL,
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "ordem" numeric DEFAULT 0 NOT NULL,
  "texto" text NOT NULL
);

ALTER TABLE public."mensagens_variantes" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public."mensagens_variantes" TO authenticated;

GRANT ALL ON public."mensagens_variantes" TO service_role;

CREATE TABLE public."pendencias_comunicacao_acoes" (
  "acao" text,
  "aluno_id" uuid NOT NULL,
  "atualizado_em" timestamptz DEFAULT now() NOT NULL,
  "criado_em" timestamptz DEFAULT now() NOT NULL,
  "data_prevista" timestamptz,
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "job_id" text,
  "observacao" text,
  "tipo_mensagem" text NOT NULL,
  "usuario_id" uuid,
  "usuario_nome" text
);

ALTER TABLE public."pendencias_comunicacao_acoes" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public."pendencias_comunicacao_acoes" TO authenticated;

GRANT ALL ON public."pendencias_comunicacao_acoes" TO service_role;

CREATE TABLE public."photo_audit_logs" (
  "aluno_id" uuid,
  "aluno_nome" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "error_reason" text,
  "formulario_id" uuid,
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "last_sign_attempt_at" timestamptz,
  "needs_resign" boolean DEFAULT false NOT NULL,
  "notes" text,
  "original_url" text,
  "photo_type" text,
  "resolved" boolean DEFAULT false NOT NULL,
  "resolved_at" timestamptz,
  "resolved_by" text,
  "sign_attempts" numeric DEFAULT 0 NOT NULL,
  "signed_url" text,
  "source" text,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "url_status" text
);

ALTER TABLE public."photo_audit_logs" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public."photo_audit_logs" TO authenticated;

GRANT ALL ON public."photo_audit_logs" TO service_role;

CREATE TABLE public."physical_assessments" (
  "arm_fat_area" numeric,
  "arm_muscle_area" numeric,
  "assessment_date" text,
  "assessment_type" text,
  "bmi" numeric,
  "body_fat_percentage" numeric,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "evaluator_id" uuid,
  "evaluator_name" text,
  "fat_mass_kg" numeric,
  "height" numeric,
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "lean_mass_kg" numeric,
  "lean_mass_percentage" numeric,
  "notes" text,
  "protocolo_dobras" text,
  "skinfold_sum" numeric,
  "student_id" uuid NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "waist_hip_ratio" numeric,
  "weight" numeric
);

ALTER TABLE public."physical_assessments" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public."physical_assessments" TO authenticated;

GRANT ALL ON public."physical_assessments" TO service_role;

CREATE TABLE public."planos_catalogo" (
  "ativo" boolean DEFAULT false NOT NULL,
  "atualizado_em" timestamptz DEFAULT now() NOT NULL,
  "criado_em" timestamptz DEFAULT now() NOT NULL,
  "descricao" text,
  "duracao_dias" numeric DEFAULT 0 NOT NULL,
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "modalidade" public.aluno_modalidade NOT NULL,
  "nome" text NOT NULL,
  "valor_padrao" numeric DEFAULT 0 NOT NULL
);

ALTER TABLE public."planos_catalogo" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public."planos_catalogo" TO authenticated;

GRANT ALL ON public."planos_catalogo" TO service_role;

CREATE TABLE public."pontos_contato" (
  "ativo" boolean DEFAULT false NOT NULL,
  "atualizado_em" timestamptz DEFAULT now() NOT NULL,
  "canal" text,
  "condicoes" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "criado_em" timestamptz DEFAULT now() NOT NULL,
  "descricao" text,
  "gatilho_tipo" text,
  "gatilho_valor" numeric DEFAULT 0 NOT NULL,
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "nome" text NOT NULL,
  "prompt_tipo" public.prompt_tipo NOT NULL,
  "total_envios" numeric DEFAULT 0 NOT NULL,
  "ultimo_envio_em" timestamptz
);

ALTER TABLE public."pontos_contato" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public."pontos_contato" TO authenticated;

GRANT ALL ON public."pontos_contato" TO service_role;

CREATE TABLE public."prescricao_modelos" (
  "atualizado_em" timestamptz DEFAULT now() NOT NULL,
  "criado_em" timestamptz DEFAULT now() NOT NULL,
  "criado_por" uuid,
  "descricao" text,
  "fitoterapicos" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "nome" text NOT NULL,
  "observacoes" text,
  "posologia" text,
  "suplementos" jsonb DEFAULT '{}'::jsonb NOT NULL
);

ALTER TABLE public."prescricao_modelos" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public."prescricao_modelos" TO authenticated;

GRANT ALL ON public."prescricao_modelos" TO service_role;

CREATE TABLE public."prescricoes" (
  "aluno_id" uuid NOT NULL,
  "atualizado_em" timestamptz DEFAULT now() NOT NULL,
  "criado_em" timestamptz DEFAULT now() NOT NULL,
  "criado_por" uuid,
  "data" text,
  "descricao" text,
  "fitoterapicos" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "observacoes" text,
  "posologia" text,
  "suplementos" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "titulo" text
);

ALTER TABLE public."prescricoes" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public."prescricoes" TO authenticated;

GRANT ALL ON public."prescricoes" TO service_role;

CREATE TABLE public."prompts_ia" (
  "ativo" boolean DEFAULT false NOT NULL,
  "atualizado_em" timestamptz DEFAULT now() NOT NULL,
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "prompt_sistema" text NOT NULL,
  "tipo" public.prompt_tipo NOT NULL
);

ALTER TABLE public."prompts_ia" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public."prompts_ia" TO authenticated;

GRANT ALL ON public."prompts_ia" TO service_role;

CREATE TABLE public."respostas_rapidas" (
  "ativo" boolean DEFAULT false NOT NULL,
  "atualizado_em" timestamptz DEFAULT now() NOT NULL,
  "categoria" text NOT NULL,
  "criado_em" timestamptz DEFAULT now() NOT NULL,
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "ordem" numeric DEFAULT 0 NOT NULL,
  "texto" text NOT NULL,
  "titulo" text NOT NULL
);

ALTER TABLE public."respostas_rapidas" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public."respostas_rapidas" TO authenticated;

GRANT ALL ON public."respostas_rapidas" TO service_role;

CREATE TABLE public."skinfold_measurements" (
  "abdominal" numeric,
  "assessment_id" uuid NOT NULL,
  "biceps" numeric,
  "chest" numeric,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "medial_calf" numeric,
  "midaxillary" numeric,
  "subscapular" numeric,
  "suprailiac" numeric,
  "thigh" numeric,
  "triceps" numeric,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public."skinfold_measurements" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public."skinfold_measurements" TO authenticated;

GRANT ALL ON public."skinfold_measurements" TO service_role;

CREATE TABLE public."source_reference" (
  "description" text,
  "document" text,
  "edition_or_version" text,
  "source_name" text NOT NULL,
  "source_priority" numeric DEFAULT 0 NOT NULL
);

ALTER TABLE public."source_reference" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public."source_reference" TO authenticated;

GRANT ALL ON public."source_reference" TO service_role;

CREATE TABLE public."system_logs" (
  "aluno_id" uuid,
  "aluno_nome" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "description" text,
  "error_message" text,
  "event_type" text NOT NULL,
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "module" text,
  "notes" text,
  "payload_summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "resolved" boolean DEFAULT false NOT NULL,
  "resolved_at" timestamptz,
  "resolved_by" text,
  "severity" text,
  "stack_trace" text,
  "status" text,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public."system_logs" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public."system_logs" TO authenticated;

GRANT ALL ON public."system_logs" TO service_role;

CREATE TABLE public."transacoes" (
  "aluno_id" uuid,
  "banco" text,
  "categoria_id" uuid,
  "competencia" text NOT NULL,
  "criado_em" timestamptz DEFAULT now() NOT NULL,
  "criado_por" uuid,
  "data_transacao" date,
  "descricao" text,
  "fitid" text,
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "origem" text NOT NULL,
  "referencia" text,
  "tipo" text NOT NULL,
  "valor" numeric NOT NULL
);

ALTER TABLE public."transacoes" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public."transacoes" TO authenticated;

GRANT ALL ON public."transacoes" TO service_role;

CREATE TABLE public."usuarios_crm" (
  "ativo" boolean DEFAULT false NOT NULL,
  "criado_em" timestamptz DEFAULT now() NOT NULL,
  "email" text,
  "id" uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  "nome" text,
  "perfil" public.app_role,
  "telefone" text
);

ALTER TABLE public."usuarios_crm" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public."usuarios_crm" TO authenticated;

GRANT ALL ON public."usuarios_crm" TO service_role;

CREATE TABLE public."workflow_config" (
  "atualizado_em" timestamptz DEFAULT now() NOT NULL,
  "atualizado_por" uuid,
  "chave" text NOT NULL,
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "secao" text NOT NULL,
  "tipo" text NOT NULL,
  "valor" text
);

ALTER TABLE public."workflow_config" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public."workflow_config" TO authenticated;

GRANT ALL ON public."workflow_config" TO service_role;

CREATE TABLE public."zapi_webhook_eventos" (
  "chave_idempotencia" text NOT NULL,
  "concluido_em" timestamptz,
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "recebido_em" timestamptz DEFAULT now() NOT NULL,
  "resultado" jsonb,
  "status" text,
  "telefone" text,
  "tipo" text
);

ALTER TABLE public."zapi_webhook_eventos" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public."zapi_webhook_eventos" TO authenticated;

GRANT ALL ON public."zapi_webhook_eventos" TO service_role;

-- As relações abaixo foram extraídas das tipagens e exigem conferência de tipos.

ALTER TABLE public."aluno_push_subscriptions" ADD CONSTRAINT "aluno_push_subscriptions_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES public."alunos" ("id");

ALTER TABLE public."body_circumferences" ADD CONSTRAINT "body_circumferences_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES public."physical_assessments" ("id");

ALTER TABLE public."community_likes" ADD CONSTRAINT "community_likes_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES public."alunos" ("id");

ALTER TABLE public."community_likes" ADD CONSTRAINT "community_likes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES public."community_posts" ("id");

ALTER TABLE public."community_posts" ADD CONSTRAINT "community_posts_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES public."alunos" ("id");

ALTER TABLE public."comunicacoes" ADD CONSTRAINT "comunicacoes_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES public."alunos" ("id");

ALTER TABLE public."daily_checkins" ADD CONSTRAINT "daily_checkins_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES public."alunos" ("id");

ALTER TABLE public."dieta_item_substitutos" ADD CONSTRAINT "dieta_item_substitutos_alimento_id_fkey" FOREIGN KEY ("alimento_id") REFERENCES public."alimentos" ("id");

ALTER TABLE public."dieta_item_substitutos" ADD CONSTRAINT "dieta_item_substitutos_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES public."dieta_itens" ("id");

ALTER TABLE public."dieta_itens" ADD CONSTRAINT "dieta_itens_alimento_id_fkey" FOREIGN KEY ("alimento_id") REFERENCES public."alimentos" ("id");

ALTER TABLE public."dieta_itens" ADD CONSTRAINT "dieta_itens_refeicao_id_fkey" FOREIGN KEY ("refeicao_id") REFERENCES public."dieta_refeicoes" ("id");

ALTER TABLE public."dieta_planos" ADD CONSTRAINT "dieta_planos_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES public."alunos" ("id");

ALTER TABLE public."dieta_refeicoes" ADD CONSTRAINT "dieta_refeicoes_plano_id_fkey" FOREIGN KEY ("plano_id") REFERENCES public."dieta_planos" ("id");

ALTER TABLE public."entregas_dia" ADD CONSTRAINT "entregas_dia_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES public."alunos" ("id");

ALTER TABLE public."feedback_agendamentos" ADD CONSTRAINT "feedback_agendamentos_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES public."alunos" ("id");

ALTER TABLE public."feedback_agendamentos" ADD CONSTRAINT "feedback_agendamentos_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES public."feedback_templates" ("id");

ALTER TABLE public."feedback_envios" ADD CONSTRAINT "feedback_envios_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES public."alunos" ("id");

ALTER TABLE public."feedback_envios" ADD CONSTRAINT "feedback_envios_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES public."feedback_templates" ("id");

ALTER TABLE public."food_measures" ADD CONSTRAINT "food_measures_food_id_fkey" FOREIGN KEY ("food_id") REFERENCES public."foods" ("id");

ALTER TABLE public."formularios" ADD CONSTRAINT "formularios_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES public."alunos" ("id");

ALTER TABLE public."historico_status" ADD CONSTRAINT "historico_status_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES public."alunos" ("id");

ALTER TABLE public."jobs_disparos" ADD CONSTRAINT "jobs_disparos_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES public."alunos" ("id");

ALTER TABLE public."mensagens_dieta" ADD CONSTRAINT "mensagens_dieta_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES public."alunos" ("id");

ALTER TABLE public."mensagens_log" ADD CONSTRAINT "mensagens_log_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES public."alunos" ("id");

ALTER TABLE public."mensagens_treino" ADD CONSTRAINT "mensagens_treino_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES public."alunos" ("id");

ALTER TABLE public."mensagens_variantes" ADD CONSTRAINT "mensagens_variantes_atualizado_por_fkey" FOREIGN KEY ("atualizado_por") REFERENCES public."usuarios_crm" ("id");

ALTER TABLE public."pendencias_comunicacao_acoes" ADD CONSTRAINT "pendencias_comunicacao_acoes_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES public."alunos" ("id");

ALTER TABLE public."skinfold_measurements" ADD CONSTRAINT "skinfold_measurements_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES public."physical_assessments" ("id");

ALTER TABLE public."transacoes" ADD CONSTRAINT "transacoes_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES public."alunos" ("id");

ALTER TABLE public."transacoes" ADD CONSTRAINT "transacoes_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES public."financeiro_categorias" ("id");

ALTER TABLE public.alunos_acesso ADD CONSTRAINT alunos_acesso_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS formularios_token_key ON public.formularios(token);

CREATE INDEX IF NOT EXISTS alunos_whatsapp_idx ON public.alunos(whatsapp);

CREATE INDEX IF NOT EXISTS jobs_disparos_pendentes_idx ON public.jobs_disparos(agendado_para) WHERE executado = false;

CREATE UNIQUE INDEX workflow_config_chave_key ON public.workflow_config(chave);

CREATE UNIQUE INDEX prompts_ia_tipo_key ON public.prompts_ia(tipo);

CREATE UNIQUE INDEX transacoes_fitid_banco_key ON public.transacoes(fitid,banco);

CREATE UNIQUE INDEX aluno_atividades_dia_aluno_id_data_referencia_tipo_key ON public.aluno_atividades_dia(aluno_id,data_referencia,tipo);

CREATE UNIQUE INDEX aluno_refeicoes_log_aluno_id_data_referencia_refeicao_id_key ON public.aluno_refeicoes_log(aluno_id,data_referencia,refeicao_id);

CREATE UNIQUE INDEX daily_checkins_aluno_id_data_checkin_key ON public.daily_checkins(aluno_id,data_checkin);

CREATE UNIQUE INDEX photo_audit_logs_formulario_id_original_url_key ON public.photo_audit_logs(formulario_id,original_url);

CREATE UNIQUE INDEX aluno_push_subscriptions_endpoint_key ON public.aluno_push_subscriptions(endpoint);

CREATE UNIQUE INDEX zapi_webhook_eventos_chave_idempotencia_key ON public.zapi_webhook_eventos(chave_idempotencia);
