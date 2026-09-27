# CRM CONSULTORIA

> **Estado da distribuição (setembro de 2026): ainda não é uma instalação independente.**
> As migrações versionadas não contêm o esquema completo do banco de produção.
> Aplicá-las a um Supabase vazio não cria tabelas essenciais como `alunos` e
> `usuarios_crm`. Não aponte uma cópia para o projeto Supabase original.

## Para desenvolver

1. Use Node.js 24, rode `npm ci` e depois `npm run dev`.
2. Crie seu próprio projeto Supabase. Consulte `.env.example` para as variáveis;
   configure as chaves privadas apenas no ambiente do servidor.
3. O esquema SQL completo, políticas RLS, funções RPC, buckets e usuário admin
   inicial ainda precisam ser exportados e versionados antes de um deploy limpo.
4. Para checagens locais: `npx tsc --noEmit`, `npx vitest run`, `npm run build`.

O feedback público por telefone usa código enviado pela Z-API. Antes de ativá-lo,
aplique `supabase/migrations/20260927193000_formulario_verificacoes.sql` na
instância que já possui a tabela `alunos` e configure a Z-API da instalação.

As integrações Z-API, automações, links externos e templates de mensagem exigem
credenciais e destinos próprios. Revise o conteúdo MPTEAM abaixo: é um briefing
histórico de criação, não uma receita de instalação da versão atual.

# PROMPT FINAL — CRM MPTEAM
## Cole este prompt no chat inicial do Lovable

Crie um CRM web completo chamado **MPTEAM CRM** para gestão de alunos de consultoria nutricional e de treino. Stack: React + TypeScript + Supabase (PostgreSQL) + Tailwind CSS. Dark mode fixo. Cores: fundo `#0D0D0D`, vermelho primário `#f50000`, cards `#1C1C1C`, texto principal `#FFFFFF`, texto secundário `#AAAAAA`. Design premium, sem elementos genéricos, sem emojis na interface, tipografia limpa.

---

## VARIÁVEIS DE AMBIENTE

```
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=
ZAPI_URL=
ZAPI_INSTANCE=
ZAPI_TOKEN=
ZAPI_CLIENT_TOKEN=
LINK_KIWIFY_MPTEAM=
LINK_KIWIFY_MP_ELITE=
LINK_KIWIFY_MP_PRESENCIAL=
LINK_CALENDLY_PRESENCIAL=https://mpteampresencial.lovable.app/
KIWIFY_WEBHOOK_SECRET=
CRON_SECRET=
GRUPO_WHATSAPP_EQUIPE=
OPENAI_API_KEY=
APP_URL=
```

---

## BANCO DE DADOS — SUPABASE

### Tabela: `alunos`
```sql
id               uuid primary key default gen_random_uuid()
nome             text not null
whatsapp         text not null
email            text
modalidade       text check (modalidade in ('mpteam','mp_elite','mp_presencial'))
plano            text
valor_plano      numeric(10,2)
prazo_dias       integer default 30
status           text check (status in (
                   'aguardando_anamnese','anamnese_recebida',
                   'em_producao','ativo','aguardando_renovacao',
                   'renovado','cancelado'
                 )) default 'aguardando_anamnese'
data_compra      timestamptz
data_anamnese    timestamptz
data_d0          timestamptz
data_expiracao   timestamptz
renovado         boolean default false
total_renovacoes integer default 0
observacoes      text
criado_em        timestamptz default now()
atualizado_em    timestamptz default now()
```
Criar trigger no Supabase: atualizar `atualizado_em` automaticamente em qualquer UPDATE.

### Tabela: `jobs_disparos`
```sql
id              uuid primary key default gen_random_uuid()
aluno_id        uuid references alunos(id) on delete cascade
tipo            text check (tipo in (
                  'boas_vindas','link_anamnese',
                  'd1','d7','d15_formulario','d21',
                  'd27','d29','d30','d31',
                  'ia_feedback_quinzenal','ia_check_shape',
                  'resumo_diario'
                ))
agendado_para   timestamptz
executado       boolean default false
executado_em    timestamptz
tentativas      integer default 0
erro            text
criado_em       timestamptz default now()
```

### Tabela: `formularios`
```sql
id              uuid primary key default gen_random_uuid()
aluno_id        uuid references alunos(id) on delete cascade
tipo            text check (tipo in ('anamnese','feedback_quinzenal','check_shape'))
token           text unique default gen_random_uuid()::text
link_publico    text
recebido_em     timestamptz default now()
respondido      boolean default false
respondido_em   timestamptz
dados_resposta  jsonb
criado_em       timestamptz default now()
```

### Tabela: `mensagens_template`
```sql
id            uuid primary key default gen_random_uuid()
modalidade    text check (modalidade in ('mpteam','mp_elite','mp_presencial','todas'))
tipo_job      text
texto         text not null
ativo         boolean default true
atualizado_em timestamptz default now()
```

Popular com uma linha para cada combinação abaixo.
Variáveis aceitas no campo `texto`: `[nome]` `[link_formulario]` `[link_check_shape]` `[link_kiwify]` `[link_calendly]`

| tipo_job | modalidade |
|---|---|
| boas_vindas | todas |
| link_anamnese | todas |
| d1 | todas |
| d7 | mpteam, mp_elite, mp_presencial |
| d15_formulario | mpteam, mp_elite, mp_presencial |
| d21 | mpteam, mp_elite, mp_presencial |
| d27 | mpteam, mp_elite, mp_presencial |
| d29 | mpteam, mp_elite, mp_presencial |
| d30 | mpteam, mp_elite, mp_presencial |
| d31 | todas |

### Tabela: `prompts_ia`
```sql
id              uuid primary key default gen_random_uuid()
tipo            text check (tipo in ('feedback_quinzenal','check_shape'))
prompt_sistema  text not null
ativo           boolean default true
atualizado_em   timestamptz default now()
```
Popular com uma linha para cada tipo. O campo `prompt_sistema` é o system prompt definido pelo admin. O sistema injeta os dados do formulário respondido como mensagem do usuário automaticamente — não faz parte do system prompt.

### Tabela: `historico_status`
```sql
id           uuid primary key default gen_random_uuid()
aluno_id     uuid references alunos(id) on delete cascade
status_de    text
status_para  text
alterado_por text
criado_em    timestamptz default now()
```
Inserir sempre que o campo `status` do aluno for alterado — kanban, perfil, cron ou webhook. Campo `alterado_por` recebe nome do usuário logado ou string `'sistema'`.

### Tabela: `mensagens_log`
```sql
id                uuid primary key default gen_random_uuid()
aluno_id          uuid references alunos(id) on delete cascade
tipo_job          text
whatsapp_destino  text
mensagem_enviada  text
status_envio      text check (status_envio in ('enviado','erro'))
erro_detalhe      text
enviado_em        timestamptz default now()
```
Aceitar `aluno_id = null` para logs do resumo diário enviado ao grupo da equipe.

### Tabela: `usuarios_crm`
```sql
id      uuid primary key references auth.users
nome    text
perfil  text check (perfil in ('admin','equipe','visualizador'))
ativo   boolean default true
```

---

## AUTENTICAÇÃO E CONTROLE DE ACESSO

Login com e-mail e senha via Supabase Auth. Após login buscar perfil em `usuarios_crm`.

- **admin:** acesso total — editar plano, valor, deletar aluno, gerenciar usuários, acessar mensagens e prompts de IA
- **equipe:** ver e editar status, confirmar D0, registrar observações, ver perfil completo — sem deletar nem editar valor
- **visualizador:** somente dashboard e tabela, sem edição

Redirecionar para `/dashboard` após login.
Rotas `/configuracoes/mensagens`, `/configuracoes/prompts` e `/admin/usuarios` somente para admin.

---

## ROTAS E PÁGINAS

```
/login
/dashboard
/alunos
/kanban
/alunos/:id
/formularios/:token              (pública, sem login)
/relatorios
/configuracoes/mensagens         (somente admin)
/configuracoes/prompts           (somente admin)
/admin/usuarios                  (somente admin)
/webhook/kiwify                  (POST público)
/webhook/anamnese                (POST público)
/api/jobs/processar              (POST autenticado por header)
/api/resumo-diario               (POST autenticado por header)
```

---

## PÁGINA: DASHBOARD `/dashboard`

Header: logo "MPTEAM CRM" em `#f50000` + nome do usuário logado + botão logout.
Sidebar fixa à esquerda com navegação completa.

**Cards de métricas:**
- Total ativos
- Aguardando anamnese
- Em produção
- Renovações no mês atual
- Cancelamentos no mês atual

**Alertas críticos** (fundo `#2A0000`, borda esquerda `#f50000`):
Exibir em destaque com título "ATENÇÃO — REQUER AÇÃO":
- Alunos com status `em_producao` e `data_anamnese` há mais de 3 dias úteis
- Alunos com `data_expiracao` em menos de 24h
- Jobs com `tentativas >= 3` e `executado = false` (erros não resolvidos)

Cada alerta mostra: nome, modalidade e motivo.

**Próximos disparos:** tabela com os 10 próximos jobs onde `executado = false`, ordenados por `agendado_para`. Colunas: nome do aluno, modalidade, tipo do job, horário agendado.

**Gráfico de barras:** alunos ativos por modalidade.

---

## PÁGINA: TABELA DE ALUNOS `/alunos`

Filtros: modalidade, status, renovado (sim/não/todos), busca por nome ou WhatsApp.

Colunas: Nome | WhatsApp | Modalidade | Plano | Valor | Status | D0 | Dias restantes | Próximo disparo | Ações

- Dias restantes em `#f50000` se < 5
- Tag de modalidade colorida: mpteam `#f50000`, mp_elite `#CC8800`, mp_presencial `#0055BB`
- Ações: "Ver perfil" + "Confirmar D0" (somente se `data_d0` nula, somente equipe/admin)

**Botão "Adicionar aluno manualmente"** (somente equipe/admin):
Modal: nome, whatsapp, email, modalidade, plano, valor_plano.
Ao salvar: criar aluno com `status = 'aguardando_anamnese'`, gerar formulário de anamnese com token, agendar `boas_vindas` (now + 1 min) e `link_anamnese` (now + 3 min).

Paginação: 25 por página. Exportar CSV.

---

## PÁGINA: KANBAN `/kanban`

Colunas fixas:
1. Aguardando Anamnese
2. Anamnese Recebida
3. Em Produção
4. Ativo
5. Aguardando Renovação

Card: nome, tag de modalidade colorida, dias restantes, próximo job agendado.
Borda esquerda `#f50000` se dias restantes < 5.
Arrastar entre colunas atualiza `status` no Supabase e registra em `historico_status` com `alterado_por = nome do usuário logado`.

---

## PÁGINA: PERFIL DO ALUNO `/alunos/:id`

**Dados:** nome, whatsapp, email, modalidade, plano, valor, prazo, status.
Admin edita tudo. Equipe edita somente status e observações.

**Botão "Confirmar D0"** (visível somente se `data_d0` nula, equipe/admin):
1. `data_d0 = now()`
2. `data_expiracao = data_d0 + 30 dias`
3. `status = 'ativo'`
4. Registrar em `historico_status` com `alterado_por = nome do usuário logado`
5. Criar jobs em `jobs_disparos`:
   - `d1` → data_d0 + 1 dia
   - `d7` → data_d0 + 7 dias
   - `d15_formulario` → data_d0 + 15 dias
   - `d21` → data_d0 + 21 dias
   - `d27` → data_d0 + 27 dias
   - `d29` → data_d0 + 29 dias
   - `d30` → data_d0 + 30 dias
   - `d31` → data_d0 + 31 dias

**Timeline do ciclo:** linha do tempo visual com compra, anamnese, D0, D+7, D+15, D+21, D+30.
Verde = executado. Relógio = agendado. Vermelho = atrasado.

**Seção formulários:** lista anamnese, feedbacks quinzenais e check shapes. Status respondido/pendente. Link para visualizar `dados_resposta` formatado.

**Seção mensagens enviadas:** log de `mensagens_log` do aluno. Colunas: tipo, mensagem (80 chars), status, data/hora.

**Histórico de status:** tabela de `historico_status`. Colunas: de, para, alterado por, quando.

**Observações internas:** textarea com salvamento automático (debounce 1s).

---

## PÁGINA: RELATÓRIOS `/relatorios`

**Aba 1 — Mensagens enviadas:**
Filtros: período, modalidade, tipo de job, status.
Colunas: aluno, modalidade, tipo, mensagem resumida, status, data/hora.
Erros em vermelho. Exportar CSV.

**Aba 2 — Histórico de status:**
Filtros: aluno, status, período.
Colunas: aluno, modalidade, de, para, alterado por, quando.
Exportar CSV.

**Aba 3 — Renovações:**
Por mês: total vencidos, renovaram, cancelaram, taxa percentual por modalidade.
Tabela + gráfico de linha.

---

## PÁGINA: MENSAGENS `/configuracoes/mensagens` (somente admin)

Listar todos os templates de `mensagens_template` agrupados por tipo de job.

Para cada tipo:
- Se modalidade = `todas`: um único textarea editável
- Se modalidade específica: três textareas lado a lado — MPTEAM | MP Elite | MP Presencial

Acima de cada campo: tags clicáveis que inserem a variável no cursor:
`[nome]` `[link_formulario]` `[link_check_shape]` `[link_kiwify]` `[link_calendly]`

Preview ao lado: mensagem com variáveis substituídas por dados fictícios (nome = "Ana Silva").
Botão "Salvar" por grupo. Atualizar `atualizado_em` ao salvar.

---

## PÁGINA: PROMPTS DE IA `/configuracoes/prompts` (somente admin)

Duas seções: **Feedback Quinzenal** e **Check Shape Mensal**.

Cada seção tem:
- Textarea grande para editar `prompt_sistema`
- Bloco informativo abaixo mostrando o que o sistema injeta automaticamente como contexto do usuário para o GPT:
  - Nome do aluno
  - Modalidade
  - Dias no protocolo (calculado desde data_d0)
  - Cada campo do formulário respondido, formatado como texto simples campo a campo
- Botão "Salvar" — atualiza `prompts_ia` e `atualizado_em`
- Botão "Testar" — modal com campos fictícios para visualizar o retorno do GPT em tempo real antes de salvar

---

## FORMULÁRIOS PÚBLICOS `/formularios/:token`

Página pública sem login. Buscar formulário pelo token.
Se token inválido ou já respondido: exibir erro.
Renderizar campos conforme `tipo` do formulário.
Design: fundo `#0D0D0D`, logo MPTEAM no topo, barra de progresso vermelha por seção, botão "Próxima seção" entre seções, botão "Enviar" somente na última seção.

---

### tipo = `anamnese`

**Seção 1 — Identificação**
- Nome completo (text, obrigatório)
- Data de nascimento (date, obrigatório)
- Sexo (select: masculino/feminino, obrigatório)
- Cidade e estado (text)
- Profissão (text)

**Seção 2 — Dados Físicos**
- Peso atual em kg (number, obrigatório)
- Altura em cm (number, obrigatório)
- Percentual de gordura, se souber (number, opcional)
- Circunferência abdominal em cm (number, opcional)

**Seção 3 — Objetivo**
- Objetivo principal (select: hipertrofia/definição/recomposição/saúde e qualidade de vida, obrigatório)
- Prazo desejado (text)
- Já fez consultoria antes? (select: sim/não)
- Se sim, o que funcionou e o que não funcionou (textarea)

**Seção 4 — Treino**
- Nível de experiência (select: iniciante/intermediário/avançado)
- Frequência por semana (select: 0 a 7)
- Tipo de treino (select: musculação/funcional/crossfit/cardio/sem treino/outro)
- Horário preferido (select: manhã/tarde/noite/variado)
- Limitação física ou lesão (textarea)

**Seção 5 — Alimentação**
- Refeições por dia (select: 1 a 6+)
- Faz dieta atualmente? (select: sim/não)
- Se sim, qual? (text)
- Restrições ou alergias (textarea)
- Alimentos que não come por preferência (textarea)
- Bebida alcoólica (select: não/eventualmente/fins de semana/frequentemente)
- Água por dia (select: menos de 1L/1 a 2L/2 a 3L/mais de 3L)

**Seção 6 — Saúde**
- Condição de saúde diagnosticada (textarea)
- Medicamento contínuo (textarea)
- Qualidade e horas de sono (text)
- Nível de estresse (select: baixo/moderado/alto/muito alto)

**Seção 7 — Expectativas**
- O que espera da consultoria (textarea, obrigatório)
- Como ficou sabendo (select: Instagram/indicação/Google/outro)

Ao submeter:
1. Salvar `dados_resposta` como JSON
2. `respondido = true`, `respondido_em = now()`
3. Atualizar `data_anamnese` no aluno
4. Atualizar `status` para `anamnese_recebida`
5. Registrar em `historico_status` com `alterado_por = 'sistema'`

---

### tipo = `feedback_quinzenal`

**Seção 1 — Identificação**
- Endereço de e-mail (text, obrigatório)
- Nome (text, obrigatório)
- Peso atual em kg (number, obrigatório)
- Telefone com DDI e DDD sem espaços ou traços — hint: "55 + DDD + número" (text, obrigatório)

**Seção 2 — Evolução e Percepção**
- Como tem se sentido em relação à evolução — hint: "Quando se olha no espelho, está satisfeito com o que vê?" (radio obrigatório):
  - Muito satisfeito, percebo mudanças claras
  - Satisfeito, mas ainda quero melhorar mais
  - Neutro, não percebi mudanças significativas
  - Insatisfeito, esperava mais resultados
- Alguém de fora comentou sobre aparência ou evolução — hint: "Às vezes, até quem não entende nada de treino solta uma frase que mostra o quanto sua transformação está visível." (textarea, opcional)
- Foco pessoal para as próximas 4 semanas — hint: "Quer reduzir gordura em alguma região específica, ganhar volume em algum grupo muscular ou melhorar a performance?" (textarea, obrigatório)

**Seção 3 — Treino**
- Adesão à rotina de treinos (radio obrigatório):
  - 100% — não perdi nenhum treino
  - 75% — perdi poucos treinos
  - 50% — metade dos treinos realizados
  - 25% — treinei pouco
  - Não consegui treinar
- Dificuldade em algum exercício ou parte do treino — hint: "Se algo estiver pegando — seja pela execução, carga ou até motivação — me conta que a gente ajusta por aqui." (textarea, opcional)
- Como está se sentindo com o treino no geral — hint: "O que está funcionando bem? O que pode melhorar?" (textarea, opcional)

**Seção 4 — Dieta, Hábitos e Espaço Livre**
- Adesão à dieta na prática (radio obrigatório):
  - 100% — segui o plano todos os dias
  - 75% — pequenas saídas do plano
  - 50% — metade do tempo no plano
  - 25% — dificuldade grande em seguir
  - Não consegui seguir o plano
- Finais de semana — hint: "A rotina mudou muito em relação aos dias de semana?" (radio opcional):
  - Mantive o plano normalmente
  - Fugi um pouco, mas voltei rápido
  - Fugi bastante e preciso ajustar
- Como está se sentindo com a dieta no geral — hint: "O que está funcionando bem? O que está difícil?" (textarea, opcional)
- Sono — hint: "Tem dormido bem? Acorda descansado ou ainda se sente cansado no dia seguinte?" (radio obrigatório):
  - Durmo bem e acordo descansado
  - Durmo ok, mas poderia melhorar
  - Sono ruim, acordo cansado frequentemente
- Água (radio obrigatório):
  - Mais de 3L por dia
  - Entre 2L e 3L por dia
  - Entre 1L e 2L por dia
  - Menos de 1L por dia
- Intestino — hint: "Tem conseguido ir ao banheiro todos os dias, sem dificuldade?" (radio obrigatório):
  - Sim, funcionando bem todos os dias
  - Irregular, alguns dias com dificuldade
  - Não, com bastante dificuldade
- Espaço livre — hint: "Se algo te incomodou, se está difícil manter a rotina, se quer compartilhar alguma conquista ou só tirar um peso do peito… escreve aqui." (textarea, opcional)

Ao submeter:
1. Salvar `dados_resposta` como JSON
2. `respondido = true`, `respondido_em = now()`
3. Criar job `ia_feedback_quinzenal` agendado para `now() + 2 horas`

---

### tipo = `check_shape`

**Seção 1 — Identificação**
- Nome completo (text, obrigatório)
- Peso atual em kg (number, obrigatório)
- Telefone com DDI e DDD sem espaços ou traços (text, obrigatório)

**Seção 2 — Evolução e Percepção**
- Como tem se sentido em relação à evolução (radio obrigatório — mesmas 4 opções do quinzenal)
- Alguém de fora comentou sobre aparência ou evolução (textarea, opcional)
- Foco pessoal para as próximas 4 semanas (textarea, obrigatório)

**Seção 3 — Treino**
- Adesão à rotina de treinos (radio obrigatório — mesmas 5 opções do quinzenal)
- Dificuldade em algum exercício ou parte do treino (textarea, opcional)
- Como está se sentindo com o treino no geral (textarea, opcional)

**Seção 4 — Dieta**
- Adesão à dieta na prática (radio obrigatório — mesmas 5 opções do quinzenal)
- Quais foram as 3 maiores dificuldades que enfrentou nos últimos dias — hint: "Falta de tempo, vontade de comer besteira, dificuldade em seguir o plano… Pode mandar real que é assim que a gente melhora juntos." (textarea, opcional)
- Conseguiu incluir algum novo hábito ou alimento na rotina — hint: "Pode ser algo simples, mas que fez diferença no dia a dia." (textarea, opcional)
- Tem algo que funcionou bem e gostaria de manter — hint: "Pode ser o tipo de refeição, os horários, combinações, praticidade…" (textarea, opcional)
- Tem algo que não funcionou bem e gostaria de ajustar — hint: "Pode ser um alimento específico, um horário difícil de seguir, ou até a quantidade." (textarea, opcional)
- Finais de semana (radio opcional — mesmas 3 opções do quinzenal)
- Como está se sentindo com a dieta no geral (textarea, opcional)

**Seção 5 — Hábitos e Espaço Livre**
- Sono (radio obrigatório — mesmas 3 opções do quinzenal)
- Água (radio obrigatório — mesmas 4 opções do quinzenal)
- Intestino (radio obrigatório — mesmas 3 opções do quinzenal)
- Espaço livre (textarea, opcional)

Ao submeter:
1. Salvar `dados_resposta` como JSON
2. `respondido = true`, `respondido_em = now()`
3. Atualizar `status` do aluno para `aguardando_renovacao`
4. Registrar em `historico_status` com `alterado_por = 'sistema'`
5. Criar job `ia_check_shape` agendado para `now() + 2 horas`

---

## WEBHOOK KIWIFY `/webhook/kiwify` — POST público

Validar assinatura com `KIWIFY_WEBHOOK_SECRET`.

Ao receber evento `order_approved`:
1. Extrair: nome, email, whatsapp, nome do produto, valor
2. Mapear produto para modalidade:
   - contém "MPTEAM" → `mpteam`
   - contém "ELITE" → `mp_elite`
   - contém "PRESENCIAL" → `mp_presencial`
3. Criar aluno com `status = 'aguardando_anamnese'`, `data_compra = now()`
4. Criar formulário tipo `anamnese`, gerar token, montar `link_publico = APP_URL + '/formularios/' + token`
5. Agendar job `boas_vindas` para now + 1 min
6. Agendar job `link_anamnese` para now + 3 min
7. Retornar HTTP 200

---

## CRON JOB DE DISPAROS `/api/jobs/processar` — POST autenticado

Autenticar via header `Authorization: Bearer {CRON_SECRET}`.
Chamar a cada 60 minutos via cron-job.org.

**Lógica para jobs de WhatsApp (todos exceto ia_feedback_quinzenal e ia_check_shape):**

1. Buscar jobs onde `executado = false` e `agendado_para <= now()` e tipo NÃO é `ia_feedback_quinzenal` nem `ia_check_shape`
2. Para cada job:
   a. Buscar dados do aluno
   b. Buscar template em `mensagens_template`: priorizar modalidade do aluno; fallback para `todas`
   c. Substituir variáveis:
      - `[nome]` → aluno.nome
      - `[link_formulario]` → se job = `d15_formulario`: criar formulário tipo `feedback_quinzenal`, retornar `link_publico`
      - `[link_check_shape]` → se job = `d30`: criar formulário tipo `check_shape`, retornar `link_publico`
      - `[link_kiwify]` → variável de ambiente correspondente à modalidade
      - `[link_calendly]` → `LINK_CALENDLY_PRESENCIAL` somente se modalidade = `mp_presencial`
   d. Chamar Z-API:
      ```
      POST {ZAPI_URL}/instances/{ZAPI_INSTANCE}/token/{ZAPI_TOKEN}/send-text
      Headers: Client-Token: {ZAPI_CLIENT_TOKEN}
      Body: { "phone": "{whatsapp}", "message": "{mensagem}" }
      ```
   e. Sucesso: `executado = true`, `executado_em = now()`, registrar em `mensagens_log` com `status_envio = 'enviado'`
   f. Erro: incrementar `tentativas`, salvar erro, registrar em `mensagens_log` com `status_envio = 'erro'`. Não marcar como executado. Após `tentativas >= 3`: marcar `executado = true`, registrar erro final.

**Regras especiais por tipo:**
- `d31`: executar somente se `aluno.renovado = false`. Se já renovado, marcar executado sem enviar.
- `d30`: além de enviar mensagem, criar formulário `check_shape` e atualizar `status` para `aguardando_renovacao`, registrar em `historico_status`.
- `d15_formulario`: criar formulário `feedback_quinzenal` antes de montar a mensagem.

**Lógica para jobs de IA (ia_feedback_quinzenal e ia_check_shape):**

1. Buscar jobs desses tipos onde `executado = false` e `agendado_para <= now()`
2. Para cada job:
   a. Buscar o formulário respondido mais recente do aluno com o tipo correspondente
   b. Buscar system prompt em `prompts_ia` pelo tipo
   c. Buscar dados do aluno (nome, modalidade, data_d0)
   d. Calcular dias no protocolo = diferença em dias entre data_d0 e hoje
   e. Formatar `dados_resposta` do formulário como texto simples campo a campo (sem JSON)
   f. Chamar OpenAI API:
      ```
      POST https://api.openai.com/v1/chat/completions
      Headers:
        Authorization: Bearer {OPENAI_API_KEY}
        Content-Type: application/json
      Body:
      {
        "model": "gpt-4o",
        "max_tokens": 1024,
        "messages": [
          {
            "role": "system",
            "content": "{prompt_sistema da tabela prompts_ia}"
          },
          {
            "role": "user",
            "content": "Nome: {nome}\nModalidade: {modalidade}\nDias no protocolo: {dias}\n\nRespostas do formulário:\n{campos formatados como texto}"
          }
        ]
      }
      ```
   g. Extrair texto de `response.choices[0].message.content`
   h. Enviar via Z-API para o WhatsApp do aluno
   i. Registrar em `mensagens_log`
   j. Marcar job como executado
   k. Erro: mesma lógica de retentativas — após 3 tentativas, marcar executado e exibir no dashboard como erro não resolvido

---

## RESUMO DIÁRIO PARA EQUIPE `/api/resumo-diario` — POST autenticado

Autenticar via header `Authorization: Bearer {CRON_SECRET}`.
Chamar uma vez por dia às **21h00 BRT** via cron-job.org.

Lógica:
1. Buscar alunos onde `status in ('em_producao','anamnese_recebida')` e `data_anamnese` registrada há 2 dias ou mais (prazo de entrega vence amanhã considerando 3 dias úteis)
2. Se nenhum aluno: não enviar nada
3. Se houver: montar mensagem e enviar para `GRUPO_WHATSAPP_EQUIPE` via Z-API

Estrutura da mensagem:
```
MPTEAM — Entregas para amanhã [data de amanhã dd/mm/yyyy]

Os seguintes alunos precisam receber o protocolo amanhã:

- [nome] | [modalidade] | anamnese recebida em [data]
- [nome] | [modalidade] | anamnese recebida em [data]

Confirmar D0 no CRM após a entrega.
```

Registrar envio em `mensagens_log` com `aluno_id = null`, `tipo_job = 'resumo_diario'`, `whatsapp_destino = GRUPO_WHATSAPP_EQUIPE`.
Se `GRUPO_WHATSAPP_EQUIPE` estiver vazio: não enviar, não quebrar.

---

## PÁGINA: ADMIN USUÁRIOS `/admin/usuarios` (somente admin)

Tabela: nome, e-mail, perfil, ativo.
Botão "Convidar usuário": modal com e-mail, nome, perfil. Cria usuário no Supabase Auth e insere em `usuarios_crm`.
Ações por linha: "Desativar" e "Alterar perfil".

---

## OBSERVAÇÕES FINAIS DE IMPLEMENTAÇÃO

1. Toda alteração de `status` — kanban, perfil, D0, cron, webhook — registra em `historico_status`.
2. Trigger de `atualizado_em` roda no Supabase via SQL, não no frontend.
3. A rota `/formularios/:token` serve os três tipos de formulário — diferenciar layout, seções e campos pelo campo `tipo` do formulário.
4. Jobs com `tentativas >= 3` aparecem no bloco de alertas críticos do dashboard.
5. O cron-job.org precisa de três jobs configurados:
   - A cada 60 min → `POST /api/jobs/processar`
   - Diariamente às 21h00 BRT → `POST /api/resumo-diario`
6. O campo `GRUPO_WHATSAPP_EQUIPE` aceita o ID de grupo da Z-API no formato `5581999999999-1234567890@g.us`.
7. Jobs de IA com erro não bloqueiam os demais jobs do mesmo ciclo — processar independentemente.
8. A tela `/configuracoes/prompts` deixa claro que o conteúdo de "DADOS DO ALUNO" no final do system prompt é substituído automaticamente pelo sistema — o admin não precisa incluir essa parte no campo editável.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://coach-compass-84.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/847adedf-6d10-4b2c-923e-69068ff845dd).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
