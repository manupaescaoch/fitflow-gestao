import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { primeiroNome } from "@/lib/nome";
import { lerCredencial } from "./credenciais.server";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o";

/* ----------------------------- Schema do plano ---------------------------- */

const ItemSchema = z.object({
  nome: z.string(),
  quantidade: z.number().nonnegative(),
  unidade: z.string().default("g"),
  kcal: z.number().nonnegative(),
  ptn: z.number().nonnegative(),
  cho: z.number().nonnegative(),
  lip: z.number().nonnegative(),
});
const RefeicaoSchema = z.object({
  nome: z.string(),
  horario: z.string().nullable().optional(),
  observacoes: z.string().nullable().optional(),
  itens: z.array(ItemSchema),
  /** Opções alternativas equivalentes (substitutos). Cada opção é uma lista
   *  completa de itens da refeição. A "Opção 1" deve ir em `itens`; "Opção 2..N"
   *  vão aqui. Cada entrada deste array é uma opção inteira. */
  opcoes: z.array(z.array(ItemSchema)).optional().default([]),
});
const PlanoSchema = z.object({ refeicoes: z.array(RefeicaoSchema) });

const PLANO_TOOL = {
  type: "function" as const,
  function: {
    name: "definir_plano_alimentar",
    description: "Retorna o plano alimentar estruturado com refeições e seus itens. Macros calculados para a quantidade indicada.",
    parameters: {
      type: "object",
      properties: {
        refeicoes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              nome: { type: "string" },
              horario: { type: "string" },
              observacoes: { type: "string" },
              itens: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    nome: { type: "string" },
                    quantidade: { type: "number" },
                    unidade: { type: "string" },
                    kcal: { type: "number" },
                    ptn: { type: "number" },
                    cho: { type: "number" },
                    lip: { type: "number" },
                  },
                  required: ["nome", "quantidade", "unidade", "kcal", "ptn", "cho", "lip"],
                },
              },
              opcoes: {
                type: "array",
                description: "Opções alternativas equivalentes da refeição (substitutos). Cada opção é uma lista de itens igual à principal. NÃO repita a Opção 1 aqui; coloque apenas Opção 2, 3, etc.",
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      nome: { type: "string" },
                      quantidade: { type: "number" },
                      unidade: { type: "string" },
                      kcal: { type: "number" },
                      ptn: { type: "number" },
                      cho: { type: "number" },
                      lip: { type: "number" },
                    },
                    required: ["nome", "quantidade", "unidade", "kcal", "ptn", "cho", "lip"],
                  },
                },
              },
            },
            required: ["nome", "itens"],
          },
        },
      },
      required: ["refeicoes"],
    },
  },
};

async function callOpenAI(opts: {
  system: string;
  user: string;
  toolName?: string;
}): Promise<{ data: unknown; error: string | null }> {
  const apiKey = (await lerCredencial("OPENAI_API_KEY"));
  if (!apiKey) return { data: null, error: "OPENAI_API_KEY não configurado" };
  try {
    const body: Record<string, unknown> = {
      model: MODEL,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
    };
    if (opts.toolName) {
      body.tools = [PLANO_TOOL];
      body.tool_choice = { type: "function", function: { name: opts.toolName } };
    }
    const resp = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const t = await resp.text();
      console.error("OpenAI error", resp.status, t);
      return { data: null, error: `OpenAI ${resp.status}` };
    }
    const json = await resp.json();
    if (opts.toolName) {
      const args = json?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      if (!args) return { data: null, error: "Resposta sem tool_call" };
      try {
        return { data: JSON.parse(args), error: null };
      } catch (e) {
        return { data: null, error: "JSON inválido da IA" };
      }
    }
    return { data: json?.choices?.[0]?.message?.content ?? "", error: null };
  } catch (e) {
    console.error("OpenAI fetch failed", e);
    return { data: null, error: "Falha ao chamar OpenAI" };
  }
}

/* ------------------------------- gerarPlanoIA ----------------------------- */

export const gerarPlanoIA = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    objetivo: z.enum(["emagrecer", "manter", "hipertrofia"]),
    peso: z.number().positive(),
    altura: z.number().positive().optional(),
    atividade: z.enum(["sedentario", "leve", "moderado", "intenso"]).default("moderado"),
    refeicoes: z.number().int().min(2).max(8).default(5),
    modo: z.enum(["simples", "avancado"]).default("simples"),
    deficit_pct: z.number().optional(),
    ptn_g_kg: z.number().optional(),
    cho_g_kg: z.number().optional(),
    lip_g_kg: z.number().optional(),
    meta_kcal: z.number().optional(),
    regiao: z.string().optional(),
    restricoes: z.string().optional(),
    nomeAluno: z.string().optional(),
  }).parse(input))
  .handler(async ({ data }) => {
    const system = `Você é MP DIET, um assistente de prescrição nutricional para nutricionistas e personal trainers brasileiros. Gere planos alimentares práticos, com alimentos comuns no Brasil, distribuição de macros equilibrada e horários realistas. Sempre retorne via tool call definir_plano_alimentar com macros calculados corretamente para a quantidade.`;

    const linhas = [
      `Aluno: ${data.nomeAluno ?? "—"}`,
      `Objetivo: ${data.objetivo}`,
      `Peso: ${data.peso} kg`,
      data.altura ? `Altura: ${data.altura} cm` : "",
      `Atividade: ${data.atividade}`,
      `Refeições/dia: ${data.refeicoes}`,
      data.meta_kcal ? `Meta calórica: ${data.meta_kcal} kcal` : "",
      data.deficit_pct ? `Déficit/superávit: ${data.deficit_pct}%` : "",
      data.ptn_g_kg ? `Proteína: ${data.ptn_g_kg} g/kg` : "",
      data.cho_g_kg ? `Carbo: ${data.cho_g_kg} g/kg` : "",
      data.lip_g_kg ? `Gordura: ${data.lip_g_kg} g/kg` : "",
      data.regiao ? `Estilo/região: ${data.regiao}` : "",
      data.restricoes ? `Restrições: ${data.restricoes}` : "",
    ].filter(Boolean).join("\n");

    const { data: out, error } = await callOpenAI({ system, user: linhas, toolName: "definir_plano_alimentar" });
    if (error || !out) return { plano: null, error: error ?? "Erro" };
    const parsed = PlanoSchema.safeParse(out);
    if (!parsed.success) return { plano: null, error: "Estrutura inválida da IA" };
    return { plano: parsed.data, error: null };
  });

/* --------------------------- importarTextoDieta --------------------------- */

export const importarTextoDieta = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    texto: z.string().min(10).max(20000),
  }).parse(input))
  .handler(async ({ data }) => {
    const system = `Você converte um texto livre de plano alimentar em estrutura JSON.

REGRAS:
1. Identifique cada refeição (Refeição 1, Café, Almoço, Lanche, Jantar, Ceia, Pré/Pós-treino...) com nome e horário.
2. Se a refeição tiver MÚLTIPLAS OPÇÕES (Opção 1, Opção 2, Opção 3, "ou", alternativas equivalentes), trate como SUBSTITUTOS:
   - "Opção 1" → vai no campo \`itens\` da refeição.
   - "Opção 2", "Opção 3", ... → cada uma vai como UMA entrada do array \`opcoes\` (cada entrada é a lista completa de itens daquela opção).
   - NÃO repita a Opção 1 dentro de \`opcoes\`.
   - NÃO some itens de opções diferentes; cada opção é uma alternativa equivalente.
3. Para cada item: nome, quantidade numérica, unidade (g, ml, un), e estime macros (kcal, ptn, cho, lip) com base em alimentos brasileiros comuns. Se faltar dado, use 0.
4. Use linhas "Total:" só para conferência — NÃO crie itens a partir delas.
5. Retorne SEMPRE via tool call definir_plano_alimentar.`;
    const { data: out, error } = await callOpenAI({ system, user: data.texto, toolName: "definir_plano_alimentar" });
    if (error || !out) return { plano: null, error: error ?? "Erro" };
    const parsed = PlanoSchema.safeParse(out);
    if (!parsed.success) return { plano: null, error: "Estrutura inválida da IA" };
    return { plano: parsed.data, error: null };
  });

/* --------------------------- completarRefeicaoIA -------------------------- */

export const completarRefeicaoIA = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    nomeRefeicao: z.string(),
    horario: z.string().optional(),
    metaKcal: z.number().optional(),
    metaPtn: z.number().optional(),
    itensAtuais: z.array(z.object({
      nome: z.string(), quantidade: z.number(), unidade: z.string(),
      kcal: z.number(), ptn: z.number(), cho: z.number(), lip: z.number(),
    })).default([]),
    contexto: z.string().optional(),
  }).parse(input))
  .handler(async ({ data }) => {
    const system = `Você completa uma refeição existente com itens adicionais coerentes. Mantenha o estilo (BR), respeite a meta da refeição se informada, e retorne a refeição completa via definir_plano_alimentar (lista de uma única refeição já com TODOS os itens — antigos + novos).`;
    const user = JSON.stringify({
      refeicao: { nome: data.nomeRefeicao, horario: data.horario, itens: data.itensAtuais },
      meta: { kcal: data.metaKcal, ptn: data.metaPtn },
      contexto: data.contexto,
    });
    const { data: out, error } = await callOpenAI({ system, user, toolName: "definir_plano_alimentar" });
    if (error || !out) return { refeicao: null, error: error ?? "Erro" };
    const parsed = PlanoSchema.safeParse(out);
    if (!parsed.success || !parsed.data.refeicoes[0]) return { refeicao: null, error: "Estrutura inválida da IA" };
    return { refeicao: parsed.data.refeicoes[0], error: null };
  });

/* --------------------------- gerarAlternativaIA --------------------------- */

export const gerarAlternativaIA = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    refeicao: RefeicaoSchema,
    instrucao: z.string().optional(),
  }).parse(input))
  .handler(async ({ data }) => {
    const system = `Você gera UMA alternativa para a refeição informada com macros aproximados (±10%). Mantenha a quantidade total de calorias e a proporção de proteína. Retorne via definir_plano_alimentar (uma única refeição substituta).`;
    const user = JSON.stringify({ refeicao_original: data.refeicao, instrucao: data.instrucao });
    const { data: out, error } = await callOpenAI({ system, user, toolName: "definir_plano_alimentar" });
    if (error || !out) return { refeicao: null, error: error ?? "Erro" };
    const parsed = PlanoSchema.safeParse(out);
    if (!parsed.success || !parsed.data.refeicoes[0]) return { refeicao: null, error: "Estrutura inválida da IA" };
    return { refeicao: parsed.data.refeicoes[0], error: null };
  });

/* ------------------------ substituirMantendoMacros ------------------------ */

export const substituirMantendoMacros = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    refeicao: RefeicaoSchema,
  }).parse(input))
  .handler(async ({ data }) => {
    const system = `Substitua TODOS os alimentos da refeição por outros equivalentes, mantendo kcal e macros (P/C/G) o mais próximo possível dos originais (±5%). Use alimentos brasileiros comuns. Retorne via definir_plano_alimentar (uma única refeição).`;
    const user = JSON.stringify({ refeicao: data.refeicao });
    const { data: out, error } = await callOpenAI({ system, user, toolName: "definir_plano_alimentar" });
    if (error || !out) return { refeicao: null, error: error ?? "Erro" };
    const parsed = PlanoSchema.safeParse(out);
    if (!parsed.success || !parsed.data.refeicoes[0]) return { refeicao: null, error: "Estrutura inválida da IA" };
    return { refeicao: parsed.data.refeicoes[0], error: null };
  });

/* ------------------------- gerarMensagemNutricao ------------------------- */

type InputNutri = { nomeAluno: string; resumoAjusteNutricional: string };

export const gerarMensagemNutricao = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((data: InputNutri) => {
    if (!data?.nomeAluno || !data?.resumoAjusteNutricional?.trim()) {
      throw new Error("Campos obrigatórios ausentes");
    }
    return data;
  })
  .handler(async ({ data }) => {
    const LOG = "[gerarMensagemNutricao]";
    console.log(`${LOG} entrada`, { nomeAluno: data.nomeAluno, tamResumo: data.resumoAjusteNutricional.length });

    const apiKey = (await lerCredencial("OPENAI_API_KEY"));
    if (!apiKey) {
      return {
        mensagem: null as string | null,
        error: "OPENAI_API_KEY não configurado",
        extraidos: null as null | { ajustes_realizados: string; dificuldades: string; medidas_otimizacao: string },
      };
    }

    const { data: promptRow, error: pErr } = await supabaseAdmin
      .from("prompts_ia")
      .select("prompt_sistema")
      .eq("tipo", "estrategia_nutricional")
      .maybeSingle();
    if (pErr) {
      console.error(`${LOG} erro prompt:`, pErr);
      return { mensagem: null, error: "Não foi possível carregar o prompt de Estratégia Nutricional. Configure em Configurações → Feedbacks → Prompts IA → Estratégia Nutricional.", extraidos: null };
    }
    const fallbackPrompt = "Você é um assistente que escreve mensagens curtas e diretas de ajuste nutricional para alunos. Tom humano, motivador, sem perguntas. Use APENAS as informações fornecidas pelo profissional.";
    const rawPrompt = promptRow?.prompt_sistema?.trim() || fallbackPrompt;
    console.log(`${LOG} prompt`, { origem: promptRow?.prompt_sistema ? "db" : "fallback", preview: rawPrompt.slice(0, 200) });

    let extraidos = {
      nome_aluno: data.nomeAluno,
      ajustes_realizados: "Não informado.",
      dificuldades: "Não informado.",
      medidas_otimizacao: "Não informado.",
    };
    try {
      const extractResp = await fetch(OPENAI_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "Você extrai informações estruturadas de um resumo livre escrito por um nutricionista sobre o ajuste nutricional de um aluno. Se alguma informação não estiver clara, use exatamente 'Não informado.'." },
            { role: "user", content: `Nome do aluno (já conhecido): ${data.nomeAluno}\n\nResumo livre:\n${data.resumoAjusteNutricional}` },
          ],
          tools: [{
            type: "function",
            function: {
              name: "extrair_ajuste_nutricional",
              description: "Extrai campos estruturados a partir do resumo livre.",
              parameters: {
                type: "object",
                properties: {
                  nome_aluno: { type: "string" },
                  ajustes_realizados: { type: "string" },
                  dificuldades: { type: "string" },
                  medidas_otimizacao: { type: "string" },
                },
                required: ["nome_aluno", "ajustes_realizados", "dificuldades", "medidas_otimizacao"],
                additionalProperties: false,
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "extrair_ajuste_nutricional" } },
        }),
      });
      if (extractResp.ok) {
        const j = await extractResp.json();
        const args = j?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
        if (args) {
          const parsed = JSON.parse(args);
          extraidos = {
            nome_aluno: parsed.nome_aluno?.trim() || data.nomeAluno,
            ajustes_realizados: parsed.ajustes_realizados?.trim() || "Não informado.",
            dificuldades: parsed.dificuldades?.trim() || "Não informado.",
            medidas_otimizacao: parsed.medidas_otimizacao?.trim() || "Não informado.",
          };
        }
      } else {
        console.error(`${LOG} extract error`, extractResp.status, await extractResp.text());
      }
    } catch (e) {
      console.error(`${LOG} falha extração:`, e);
    }
    // Mensagens enviadas ao aluno usam apenas o primeiro nome
    extraidos.nome_aluno = primeiroNome(extraidos.nome_aluno) || extraidos.nome_aluno;
    console.log(`${LOG} extraidos`, extraidos);

    const vars: Record<string, string> = {
      nome_aluno: extraidos.nome_aluno,
      ajustes_realizados: extraidos.ajustes_realizados,
      dificuldades: extraidos.dificuldades,
      medidas_otimizacao: extraidos.medidas_otimizacao,
      resumo_ajuste_nutricional: data.resumoAjusteNutricional,
    };
    const systemPrompt = rawPrompt.replace(/\{\{\s*(\w+)\s*\}\}|\[(\w+)\]/g, (_m, a, b) => {
      const key = (a ?? b) as string;
      return vars[key] ?? `{{${key}}}`;
    });

    const guard = [
      "REGRAS OBRIGATÓRIAS (sobrepõem qualquer instrução anterior):",
      "- NUNCA faça perguntas ao aluno nem peça mais informações.",
      "- NUNCA escreva frases como 'me informe', 'preciso saber', 'poderia me dizer'.",
      "- Se algum dado não foi informado, simplesmente omita essa parte na mensagem.",
      "- Sempre entregue a mensagem FINAL pronta para enviar ao aluno via WhatsApp, em tom humano e direto.",
      "- Use exclusivamente o conteúdo do resumo fornecido pelo nutricionista.",
    ].join("\n");
    const finalSystemPrompt = `${systemPrompt}\n\n${guard}`;
    console.log(`${LOG} prompt final`, { preview: finalSystemPrompt.slice(0, 300) });

    const userContent = [
      `Nome do aluno: ${extraidos.nome_aluno}`,
      ``,
      `Resumo do nutricionista:`,
      data.resumoAjusteNutricional,
      ``,
      `Reescreva esse resumo como uma mensagem curta, humana e direta para o aluno via WhatsApp. Use APENAS as informações acima — não invente refeições, alimentos, dificuldades, observações ou orientações que não estejam no resumo. Não faça perguntas. Comece pelo primeiro nome do aluno.`,
    ].join("\n");

    try {
      const resp = await fetch(OPENAI_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o",
          max_tokens: 800,
          messages: [
            { role: "system", content: finalSystemPrompt },
            { role: "user", content: userContent },
          ],
        }),
      });
      if (!resp.ok) {
        const t = await resp.text();
        console.error(`${LOG} OpenAI error`, resp.status, t);
        return { mensagem: null, error: `OpenAI ${resp.status}`, extraidos: null };
      }
      const json = await resp.json();
      const mensagem = json?.choices?.[0]?.message?.content?.trim() ?? null;
      console.log(`${LOG} resposta`, { status: resp.status, tamMensagem: mensagem?.length ?? 0 });
      if (!mensagem) return { mensagem: null, error: "Resposta vazia da IA", extraidos: null };
      return {
        mensagem,
        error: null,
        extraidos: {
          ajustes_realizados: extraidos.ajustes_realizados,
          dificuldades: extraidos.dificuldades,
          medidas_otimizacao: extraidos.medidas_otimizacao,
        },
      };
    } catch (e) {
      console.error(`${LOG} fetch failed`, e);
      return { mensagem: null, error: "Falha ao chamar OpenAI", extraidos: null };
    }
  });
