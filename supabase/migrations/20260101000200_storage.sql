-- Buckets privados usados pela aplicação. URLs temporárias são emitidas pelo
-- servidor após verificar a identidade do aluno ou o token do formulário.
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('formularios', 'formularios', false),
  ('aluno-fotos', 'aluno-fotos', false),
  ('anamnese-uploads', 'anamnese-uploads', false)
ON CONFLICT (id) DO NOTHING;
