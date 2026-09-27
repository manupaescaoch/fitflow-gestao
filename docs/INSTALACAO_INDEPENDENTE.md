# Instalação independente

O código da aplicação é executável fora do Lovable. O build usa Vite,
TanStack Start e Nitro com saída para Cloudflare Workers; o banco é PostgreSQL
via Supabase. O pacote `@lovable.dev/mcp-js` ainda é usado nas rotas MCP, mas
não exige o editor nem a hospedagem do Lovable.

## Estado da portabilidade

O repositório **não contém o esquema completo do banco atual**. As migrações
versionadas começam depois da criação de tabelas fundamentais (`alunos`,
`usuarios_crm`, `formularios`, etc.). As funções RPC, políticas de acesso,
triggers, buckets e configuração inicial também precisam ser exportados da
instância original. Portanto, ainda não é possível instalar o aplicativo do
zero com todas as funcionalidades, mesmo que o build passe.

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
