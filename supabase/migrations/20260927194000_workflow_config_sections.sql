-- As seções são extensíveis por instalação; a lista fixa de 06/09 bloqueia
-- configurações de integração gravadas pelo próprio aplicativo ("conexoes").
ALTER TABLE public.workflow_config DROP CONSTRAINT IF EXISTS workflow_config_secao_check;
