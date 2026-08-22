import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { primeiroNome } from "@/lib/nome";
import { gerarRespostaFeedbackIA } from "./motor-core.server";

function renderTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (_m, k) => vars[k] ?? `{${k}}`);
}

function fallbackFollowup(promptTipo: string, nomeCurto: string): string | null {
  if (promptTipo === "followup_d7") {
    return `Fala, ${nomeCurto}! Tudo certo?\n\nPrimeira semana é pra tirar o plano do papel e ver onde a rotina aperta.\n\nConseguiu seguir treino e dieta ou travou em alguma parte?\n\nMe responde direto: o que funcionou e o que ficou só na intenção?`;
  }
  if (promptTipo === "followup_d21") {
    return `Fala, ${nomeCurto}! Tudo certo?\n\nJá deu tempo de sentir o que encaixou de verdade na rotina.\n\nTreino e dieta seguiram bem ou teve algum ponto que travou?\n\nMe responde direto: o que funcionou, o que não rolou e se precisa ajustar algo.`;
  }
  return null;
}

async function getConfigMap(chaves: string[]): Promise<Record<string, string>> {
  const { data } = await supabaseAdmin
    .from("workflow_config")
    .select("chave, valor")
    .in("chave", chaves);
  const out: Record<string, string> = {};
  (data ?? []).forEach((r: any) => { out[r.chave] = r.valor ?? ""; });
  return out;
}

async function gerarTextoIA(promptTipo: string, nomeAluno: string): Promise<{ mensagem: string | null; error: string | null }> {
  const nomeCurto = primeiroNome(nomeAluno);
  const fallback = fallbackFollowup(promptTipo, nomeCurto);
  if (fallback) return { mensagem: fallback, error: null };
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return { mensagem: fallback, error: fallback ? null : "LOVABLE_API_KEY ausente" };
  const { data: promptRow } = await supabaseAdmin
    .from("prompts_ia")
    .select("prompt_sistema")
    .eq("tipo", promptTipo as any)
    .maybeSingle();
  const rawPrompt = promptRow?.prompt_sistema?.trim()
    || `Você escreve mensagens curtas e motivadoras para alunos de consultoria. Seja direto e caloroso.`;
  const sys = rawPrompt.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k) => k === "nome_aluno" ? nomeCurto : `{{${k}}}`)
    + "\n\nIMPORTANTE: Escreva a mensagem final pronta para envio. NÃO use placeholders.";
  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk", "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: `Gere a mensagem de WhatsApp para ${nomeCurto}.` },
        ],
        max_tokens: 1200,
      }),
    });
    if (!r.ok) {
      const erro = r.status === 402 ? "Créditos de IA esgotados."
        : r.status === 429 ? "Muitas requisições à IA."
        : `IA indisponível (${r.status})`;
      return { mensagem: fallback, error: fallback ? null : erro };
    }
    const j = await r.json();
    const m = j?.choices?.[0]?.message?.content?.trim() ?? "";
    return m ? { mensagem: m, error: null } : { mensagem: fallback, error: fallback ? null : "IA vazia" };
  } catch (e) {
    return { mensagem: fallback, error: fallback ? null : (e instanceof Error ? e.message : "Falha IA") };
  }
}

export async function previewMensagemJobImpl(args: {
  alunoId: string;
  tipo: string;
  formularioId?: string | null;
}): Promise<{ mensagem: string | null; error: string | null }> {
  const { data: aluno } = await supabaseAdmin
    .from("alunos")
    .select("id, nome, whatsapp")
    .eq("id", args.alunoId)
    .maybeSingle();
  if (!aluno) return { mensagem: null, error: "Aluno não encontrado" };

  const cfg = await getConfigMap([
    "MSG_CONFIRMACAO_ANAMNESE",
    "MSG_LINK_QUINZENAL",
    "MSG_LINK_MENSAL",
    "MSG_POS_FEEDBACK_MENSAL",
    "MSG_ANIVERSARIO",
    "MSG_POS_ENTREGA_D1",
    "FORM_URL_QUINZENAL",
    "FORM_URL_MENSAL",
    "MSG_LEMBRETE_FEEDBACK",
    "APP_BASE_URL",
  ]);

  const nome = primeiroNome(aluno.nome);

  switch (args.tipo) {
    case "anamnese_confirmacao":
      return { mensagem: renderTemplate(cfg["MSG_CONFIRMACAO_ANAMNESE"] || "", { nome }), error: null };
    case "feedback_quinzenal_link":
      return { mensagem: renderTemplate(cfg["MSG_LINK_QUINZENAL"] || "", { nome, link: cfg["FORM_URL_QUINZENAL"] || "" }), error: null };
    case "feedback_mensal_link":
      return { mensagem: renderTemplate(cfg["MSG_LINK_MENSAL"] || "", { nome, link: cfg["FORM_URL_MENSAL"] || "" }), error: null };
    case "pos_feedback_mensal":
      return { mensagem: renderTemplate(cfg["MSG_POS_FEEDBACK_MENSAL"] || "", { nome }), error: null };
    case "pos_entrega_d1":
      return { mensagem: renderTemplate(cfg["MSG_POS_ENTREGA_D1"] || "", { nome }), error: null };
    case "aniversario":
      return { mensagem: renderTemplate(cfg["MSG_ANIVERSARIO"] || "", { nome }), error: null };
    case "feedback_link_lembrete": {
      let link = "";
      let tipoForm: string | null = null;
      if (args.formularioId) {
        const { data: f } = await supabaseAdmin
          .from("formularios")
          .select("id, tipo, token, link_publico")
          .eq("id", args.formularioId)
          .maybeSingle();
        if (f) {
          tipoForm = f.tipo;
          link = f.link_publico
            || (cfg["APP_BASE_URL"] ? `${cfg["APP_BASE_URL"].replace(/\/$/, "")}/formularios/${f.token}` : `/formularios/${f.token}`);
        }
      } else {
        link = cfg["FORM_URL_QUINZENAL"] || cfg["FORM_URL_MENSAL"] || "";
      }
      const tplCfg = cfg["MSG_LEMBRETE_FEEDBACK"] || "";
      const tpl = tplCfg.trim().length > 0
        ? tplCfg
        : "Fala, {nome}! Tudo certo?\n\nSeu feedback ainda está pendente.\nPreenche por aqui:\n\n{link_feedback}";
      return { mensagem: renderTemplate(tpl, { nome, link_feedback: link, link, tipo: tipoForm ?? "feedback" }), error: null };
    }
    case "followup_d7":
    case "followup_d21": {
      const r = await gerarTextoIA(args.tipo, aluno.nome);
      return { mensagem: r.mensagem, error: r.error };
    }
    case "feedback_quinzenal_resposta":
    case "feedback_mensal_resposta": {
      const tipoForm = args.tipo === "feedback_quinzenal_resposta" ? "feedback_quinzenal" : "feedback_mensal";
      const r = await gerarRespostaFeedbackIA(args.alunoId, tipoForm, args.formularioId ?? null);
      return { mensagem: r.mensagem, error: r.error };
    }
    default:
      return { mensagem: null, error: `Prévia não suportada para o tipo: ${args.tipo}` };
  }
}