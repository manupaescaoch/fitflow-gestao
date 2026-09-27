# Instalação independente

O código da aplicação é executável fora do Lovable. O build usa Vite,
TanStack Start e Nitro com saída para Cloudflare Workers; o banco é PostgreSQL
via Supabase. O pacote `@lovable.dev/mcp-js` ainda é usado nas rotas MCP, mas
não exige o editor nem a hospedagem do Lovable.

## Estado da portabilidade

As migrações `20260101*` reconstroem uma primeira versão das tabelas, funções,
políticas e buckets a partir do código. **Ainda não foram executadas em uma
instância Supabase vazia.** Não representam o esquema original e faltam RPCs,
rotinas e regras de acesso para garantir todas as funcionalidades. Veja
[`BANCO_RECONSTRUCAO.md`](BANCO_RECONSTRUCAO.md).

Para uma instância nova, aplique as migrações **na ordem do nome** e crie o
primeiro usuário no Supabase Auth. Depois, vincule o UUID desse usuário ao CRM
com `INSERT INTO public.usuarios_crm (id, nome, email, perfil, ativo)
VALUES ('UUID_DO_AUTH', 'Administrador', 'email@exemplo.com', 'admin', true);`.
Use apenas dados fictícios para a validação inicial. Não rode as migrações
inferidas no banco que já está em produção.

## Rodar e compilar o código

1. Instale Node.js 24 e execute `npm ci`.
2. Copie `.env.example` para `.env` e preencha com **seu próprio** projeto
   Supabase. Nunca reutilize a URL ou chaves da instalação original.
3. Configure `SUPABASE_SERVICE_ROLE_KEY` e demais segredos somente no servidor;
   apenas variáveis `VITE_` de chave publicável podem ir ao navegador.
   Defina `VITE_APP_URL` com o domínio público da cópia para os links e QR codes.
4. Execute `npm run dev`. Para testar: `npx tsc --noEmit`, `npx vitest run`.
5. Compile com `NODE_OPTIONS=--max-old-space-size=6144 npm run build`.
   O artefato de deploy é `.output/server` com arquivos públicos em
   `.output/public`. O build gera a configuração Wrangler em
   `.wrangler/deploy/config.json`.
6. Depois de configurar as variáveis no seu ambiente Cloudflare e autenticar
   o deploy, use `npx nitro deploy --prebuilt`. Esta etapa ainda não foi
   executada nesta revisão; nenhum ambiente externo foi publicado.

## Serviços que precisam de configuração própria

- **Banco e autenticação:** projeto Supabase separado, esquema completo,
  funções RPC, RLS, storage e primeiro usuário administrador.
- **IA:** `AI_API_KEY` (ou `OPENAI_API_KEY`), `AI_MODEL` e, para outro
  endpoint compatível, `AI_CHAT_URL`. O fallback `LOVABLE_API_KEY` atende
  apenas à instalação antiga.
- **WhatsApp:** credenciais Z-API, número de suporte, destinos de grupos,
  mensagens, webhooks e segredos dos webhooks.
- **Rotinas:** configurar os jobs externos para chamar os hooks com
  `CRON_SECRET`. Sem agendador, os disparos automáticos não acontecem.
- **Marca e links:** revisar imagens, textos e URLs MPTEAM no código,
  templates, PDF de boas-vindas e variáveis de workflow antes de enviar
  mensagens a alunos.

A migração `20260927193000_formulario_verificacoes.sql` exige a tabela
`public.alunos` e precisa ser aplicada antes de ativar os feedbacks por telefone.
Não use a branch como instalação pública até exportar o banco, aplicar as
migrações em uma instância vazia e testar os fluxos com contas de teste.
