ALTER TABLE public.workflow_config DROP CONSTRAINT IF EXISTS workflow_config_secao_check;
ALTER TABLE public.workflow_config ADD CONSTRAINT workflow_config_secao_check CHECK (secao = ANY (ARRAY['motor','ciclo','mensagens','formularios','notificacoes_diarias','notificacoes_feedbacks','roteamento_feedbacks_fu','roteamento_respostas_ia','bloqueio_envios_alunos','ia','lembretes','renovacao']));

INSERT INTO public.workflow_config (chave, valor, tipo, secao) VALUES
  ('MOTOR_ATIVO','true','boolean','motor'),
  ('DIA_FOLLOWUP_1','7','integer','ciclo'),
  ('UNIDADE_FOLLOWUP_1','dias','text','ciclo'),
  ('DIA_FEEDBACK_QUINZENAL','15','integer','ciclo'),
  ('UNIDADE_FEEDBACK_QUINZENAL','dias','text','ciclo'),
  ('DIA_FOLLOWUP_2','21','integer','ciclo'),
  ('UNIDADE_FOLLOWUP_2','dias','text','ciclo'),
  ('DIA_FEEDBACK_MENSAL','30','integer','ciclo'),
  ('UNIDADE_FEEDBACK_MENSAL','dias','text','ciclo'),
  ('JOB_HORARIO','08:00','time','ciclo'),
  ('DIAS_SEMANA','1,2,3,4,5','text','ciclo'),
  ('FUSO_HORARIO','America/Recife','text','ciclo'),
  ('IA_ANAMNESE_VALOR','2','integer','ia'),
  ('IA_ANAMNESE_UNIDADE','horas','text','ia'),
  ('IA_ANAMNESE_MODO','automatico','text','ia'),
  ('IA_ANAMNESE_JANELA_INICIO','08:00','time','ia'),
  ('IA_ANAMNESE_JANELA_FIM','20:00','time','ia'),
  ('IA_QUINZENAL_VALOR','2','integer','ia'),
  ('IA_QUINZENAL_UNIDADE','horas','text','ia'),
  ('IA_QUINZENAL_MODO','automatico','text','ia'),
  ('IA_QUINZENAL_JANELA_INICIO','08:00','time','ia'),
  ('IA_QUINZENAL_JANELA_FIM','20:00','time','ia'),
  ('IA_MENSAL_VALOR','4','integer','ia'),
  ('IA_MENSAL_UNIDADE','horas','text','ia'),
  ('IA_MENSAL_MODO','manual','text','ia'),
  ('IA_MENSAL_JANELA_INICIO','08:00','time','ia'),
  ('IA_MENSAL_JANELA_FIM','20:00','time','ia'),
  ('LEMBRETE_QUINZENAL_ATIVO','true','boolean','lembretes'),
  ('LEMBRETE_QUINZENAL_VALOR','24','integer','lembretes'),
  ('LEMBRETE_QUINZENAL_UNIDADE','horas','text','lembretes'),
  ('LEMBRETE_QUINZENAL_MAX','2','integer','lembretes'),
  ('LEMBRETE_MENSAL_ATIVO','true','boolean','lembretes'),
  ('LEMBRETE_MENSAL_VALOR','24','integer','lembretes'),
  ('LEMBRETE_MENSAL_UNIDADE','horas','text','lembretes'),
  ('LEMBRETE_MENSAL_MAX','2','integer','lembretes'),
  ('RENOVACAO_ETAPAS','[{"dias":30,"quando":"antes"},{"dias":15,"quando":"antes"},{"dias":7,"quando":"antes"},{"dias":0,"quando":"dia"},{"dias":3,"quando":"apos"}]','text','renovacao')
ON CONFLICT (chave) DO NOTHING;

INSERT INTO public.mensagens_variantes (chave, texto, ativo, ordem) VALUES
  ('MSG_CONFIRMACAO_ANAMNESE','Oi {primeiro_nome}! Recebemos sua anamnese aqui. Já estou analisando tudo com calma e em breve te retorno com os próximos passos. 💪', true, 0),
  ('MSG_CONFIRMACAO_ENTREGA','{primeiro_nome}, seu planejamento foi entregue em {data_entrega}! Qualquer dúvida é só me chamar por aqui.', true, 0),
  ('MSG_FOLLOWUP_D7','{primeiro_nome}, como foi essa primeira semana com o novo planejamento? Conseguiu seguir treino e dieta?', true, 0),
  ('MSG_LINK_QUINZENAL','{primeiro_nome}, chegou a hora do seu feedback quinzenal. Responde aqui pra mim: {link_feedback}', true, 0),
  ('MSG_LEMBRETE_QUINZENAL','{primeiro_nome}, vi que seu feedback quinzenal ainda está pendente. Leva 2 minutinhos: {link_feedback}', true, 0),
  ('MSG_FOLLOWUP_D21','{primeiro_nome}, seguimos firmes? Me conta como estão o treino e a alimentação nessa fase.', true, 0),
  ('MSG_LINK_MENSAL','{primeiro_nome}, fechamos mais um mês! Preenche seu feedback mensal com fotos e medidas: {link_feedback}', true, 0),
  ('MSG_LEMBRETE_MENSAL','{primeiro_nome}, seu feedback mensal ainda está pendente. Assim que preencher, te mando a análise: {link_feedback}', true, 0),
  ('MSG_RENOVACAO_ANTES','{primeiro_nome}, seu plano {plano} vence em {dias_para_vencer} dias ({data_vencimento}). Quer garantir a continuidade? {link_renovacao}', true, 0),
  ('MSG_RENOVACAO_DIA','{primeiro_nome}, hoje é o último dia do seu plano {plano}. Bora renovar e seguir evoluindo? {link_renovacao}', true, 0),
  ('MSG_RENOVACAO_APOS','{primeiro_nome}, seu plano venceu em {data_vencimento}. Ainda dá tempo de retomar sem perder o ritmo: {link_renovacao}', true, 0);

INSERT INTO public.prompts_ia (tipo, prompt_sistema, ativo) VALUES
  ('anamnese','Você é o assistente do profissional {profissional}. Com base na anamnese do aluno, escreva uma devolutiva curta, acolhedora e objetiva em português do Brasil, destacando pontos de atenção e os próximos passos. Não invente dados.', true),
  ('feedback_quinzenal','Você é o assistente do profissional {profissional}. Com base no feedback quinzenal do aluno, escreva uma devolutiva curta em português do Brasil: reconheça o que foi bem, aponte 1 ou 2 ajustes objetivos e finalize com incentivo. Não invente dados.', true),
  ('feedback_mensal','Você é o assistente do profissional {profissional}. Com base no feedback mensal (respostas, fotos e medidas), escreva uma análise de evolução em português do Brasil, com pontos positivos, ajustes recomendados e a meta do próximo mês. Não invente dados.', true)
ON CONFLICT (tipo) DO NOTHING;