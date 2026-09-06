import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { primeiroNome } from "@/lib/nome";
import { lerCredencial } from "./credenciais.server";

type Pergunta = {
  id: string;
  secao?: string;
  label: string;
};

function formatRespostas(perguntas: Pergunta[], respostas: Record<string, unknown>): string {
  const bySecao: Record<string, string[]> = {};
  for (const p of perguntas) {
    const sec = p.secao || "Geral";
    const r = respostas?.[p.id];
    const valor = r === undefined || r === null || r === "" ? "(não respondido)" : String(r);
    if (!bySecao[sec]) bySecao[sec] = [];
    bySecao[sec].push(`- ${p.label}: ${valor}`);
  }
  return Object.entries(bySecao)
    .map(([sec, lines]) => `## ${sec}\n${lines.join("\n")}`)
    .join("\n\n");
}

export const gerarRespostaFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { envioId: string }) => {
    if (!data?.envioId) throw new Error("envioId obrigatório");
    return data;
  })
  .handler(async ({ data }) => {
    const apiKey = (await lerCredencial("OPENAI_API_KEY"));
    if (!apiKey) return { mensagem: null as string | null, error: "OPENAI_API_KEY não configurado" };

    // Load envio + template + aluno
    const { data: envio, error: envErr } = await supabaseAdmin
      .from("feedback_envios")
      .select("id, respostas, template_id, aluno_id, status")
      .eq("id", data.envioId)
      .maybeSingle();
    if (envErr || !envio) return { mensagem: null, error: "Envio não encontrado" };
    if (!envio.respostas) return { mensagem: null, error: "Envio ainda não foi respondido" };

    const [{ data: tpl }, { data: aluno }] = await Promise.all([
      supabaseAdmin.from("feedback_templates").select("tipo, perguntas").eq("id", envio.template_id).maybeSingle(),
      supabaseAdmin.from("alunos").select("nome").eq("id", envio.aluno_id).maybeSingle(),
    ]);
    if (!tpl) return { mensagem: null, error: "Template não encontrado" };
    if (!aluno) return { mensagem: null, error: "Aluno não encontrado" };

    const tipo = tpl.tipo;
    const validTipos = ["anamnese", "feedback_quinzenal", "feedback_mensal", "check_shape", "treino"] as const;
    if (!validTipos.includes(tipo as (typeof validTipos)[number])) {
      return { mensagem: null, error: `Tipo de prompt inválido: ${tipo}` };
    }

    const { data: promptRow } = await supabaseAdmin
      .from("prompts_ia")
      .select("prompt_sistema")
      .eq("tipo", tipo as (typeof validTipos)[number])
      .maybeSingle();
    const rawPrompt = promptRow?.prompt_sistema?.trim()
      || `Você é um assistente que responde feedback de aluno. Seja claro, objetivo e motivador.`;

    const perguntas = (Array.isArray(tpl.perguntas) ? tpl.perguntas : []) as Pergunta[];
    const respostasFmt = formatRespostas(perguntas, envio.respostas as Record<string, unknown>);

    const nomeCurto = primeiroNome(aluno.nome);
    const vars: Record<string, string> = {
      nome_aluno: nomeCurto,
      respostas: respostasFmt,
    };
    const systemPrompt = rawPrompt.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k) => vars[k] ?? `{{${k}}}`);

    const userContent = `Nome do aluno: ${nomeCurto}\n\nRespostas:\n${respostasFmt}`;

    try {
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
        }),
      });
      if (!resp.ok) {
        const t = await resp.text();
        console.error("OpenAI error", resp.status, t);
        if (resp.status === 401) return { mensagem: null, error: "Chave OpenAI inválida (401)." };
        if (resp.status === 429) return { mensagem: null, error: "Limite de requisições excedido. Tente novamente em instantes." };
        return { mensagem: null, error: `Erro OpenAI (${resp.status})` };
      }
      const json = await resp.json();
      const mensagem = json?.choices?.[0]?.message?.content?.trim() ?? null;
      if (!mensagem) return { mensagem: null, error: "Resposta vazia da IA" };
      return { mensagem, error: null };
    } catch (e) {
      console.error("OpenAI fetch failed", e);
      return { mensagem: null, error: "Falha ao chamar a OpenAI" };
    }
  });

// ---------------------------------------------------------------------------
// gerarRespostaFormulario — gera resposta IA a partir de um registro em
// `formularios` (fluxo público de anamnese / feedback mensal / quinzenal).
// ---------------------------------------------------------------------------

const TIPO_TO_PROMPT: Record<string, string> = {
  anamnese: "anamnese",
  feedback_mensal: "feedback_mensal",
  feedback_quinzenal: "feedback_quinzenal",
  check_shape: "check_shape",
  treino: "treino",
};

const TIPO_LABEL: Record<string, string> = {
  anamnese: "Resposta IA — Anamnese",
  feedback_mensal: "Resposta IA — Feedback mensal",
  feedback_quinzenal: "Resposta IA — Feedback quinzenal",
  check_shape: "Resposta IA — Check shape",
  treino: "Resposta IA — Treino",
};

function formatDadosResposta(dados: unknown, indent = ""): string {
  if (dados === null || dados === undefined || dados === "") return "(não respondido)";
  if (typeof dados === "string" || typeof dados === "number" || typeof dados === "boolean") {
    return String(dados);
  }
  if (Array.isArray(dados)) {
    return dados.map((v) => `- ${formatDadosResposta(v, indent + "  ")}`).join("\n");
  }
  if (typeof dados === "object") {
    const lines: string[] = [];
    for (const [k, v] of Object.entries(dados as Record<string, unknown>)) {
      // Pula URLs de fotos para não poluir o prompt
      if (typeof v === "string" && v.startsWith("http") && /\.(png|jpe?g|webp)/i.test(v)) {
        lines.push(`${indent}- ${k}: (foto enviada)`);
        continue;
      }
      const isObj = v && typeof v === "object";
      if (isObj) {
        lines.push(`${indent}- ${k}:`);
        lines.push(formatDadosResposta(v, indent + "  "));
      } else {
        const valor = v === null || v === undefined || v === "" ? "(não respondido)" : String(v);
        lines.push(`${indent}- ${k}: ${valor}`);
      }
    }
    return lines.join("\n");
  }
  return String(dados);
}

export const gerarRespostaFormulario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { formularioId: string }) => {
    if (!data?.formularioId) throw new Error("formularioId obrigatório");
    return data;
  })
  .handler(async ({ data }) => {
    const apiKey = (await lerCredencial("OPENAI_API_KEY"));
    if (!apiKey) return { mensagem: null as string | null, error: "OPENAI_API_KEY não configurado" };

    const { data: form, error: fErr } = await supabaseAdmin
      .from("formularios")
      .select("id, tipo, dados_resposta, aluno_id, respondido")
      .eq("id", data.formularioId)
      .maybeSingle();
    if (fErr || !form) return { mensagem: null, error: "Formulário não encontrado" };
    if (!form.respondido || !form.dados_resposta) {
      return { mensagem: null, error: "Formulário ainda não foi respondido" };
    }
    if (!form.aluno_id) return { mensagem: null, error: "Formulário não está vinculado a um aluno" };

    const promptTipo = TIPO_TO_PROMPT[form.tipo];
    if (!promptTipo) return { mensagem: null, error: `Tipo de formulário sem prompt: ${form.tipo}` };

    const [{ data: aluno }, { data: promptRow }] = await Promise.all([
      supabaseAdmin.from("alunos").select("nome").eq("id", form.aluno_id).maybeSingle(),
      supabaseAdmin.from("prompts_ia").select("prompt_sistema").eq("tipo", promptTipo as any).maybeSingle(),
    ]);
    if (!aluno) return { mensagem: null, error: "Aluno não encontrado" };

    const rawPrompt = promptRow?.prompt_sistema?.trim()
      || `Você é um assistente que responde feedback de aluno. Seja claro, objetivo e motivador.`;

    const respostasFmt = formatDadosResposta(form.dados_resposta);
    const nomeCurto = primeiroNome(aluno.nome);
    const vars: Record<string, string> = {
      nome_aluno: nomeCurto,
      respostas: respostasFmt,
    };
    const systemPrompt = rawPrompt.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k) => vars[k] ?? `{{${k}}}`);
    const userContent = `Nome do aluno: ${nomeCurto}\n\nRespostas:\n${respostasFmt}`;

    try {
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
        }),
      });
      if (!resp.ok) {
        const t = await resp.text();
        console.error("OpenAI error", resp.status, t);
        if (resp.status === 401) return { mensagem: null, error: "Chave OpenAI inválida (401)." };
        if (resp.status === 429) return { mensagem: null, error: "Limite de requisições excedido. Tente novamente em instantes." };
        return { mensagem: null, error: `Erro OpenAI (${resp.status})` };
      }
      const json = await resp.json();
      const mensagem = json?.choices?.[0]?.message?.content?.trim() ?? null;
      if (!mensagem) return { mensagem: null, error: "Resposta vazia da IA" };

      // Persiste em mensagens_log (status pendente — equipe revisa e envia)
      const { error: logErr } = await supabaseAdmin.from("mensagens_log").insert({
        aluno_id: form.aluno_id,
        tipo_job: TIPO_LABEL[form.tipo] ?? `Resposta IA — ${form.tipo}`,
        mensagem_enviada: mensagem,
        status_envio: "pendente" as any,
      });
      if (logErr) console.error("mensagens_log insert error", logErr);

      return { mensagem, error: null };
    } catch (e) {
      console.error("OpenAI fetch failed", e);
      return { mensagem: null, error: "Falha ao chamar a OpenAI" };
    }
  });