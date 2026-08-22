import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { enviarWhatsAppTeste } from "./zapi-send.server";
import { MSG_PRAZO_3_DIAS_UTEIS } from "./mensagens-fixas";
import { primeiroNome } from "@/lib/nome";

const TIPOS_RESPOSTA = [
  "feedback_mensal_resposta",
  "pos_feedback_mensal",
] as const;

type TipoJob = (typeof TIPOS_RESPOSTA)[number];

function formatDados(dados: unknown, indent = ""): string {
  if (dados === null || dados === undefined || dados === "") return "(não respondido)";
  if (typeof dados !== "object") return String(dados);
  if (Array.isArray(dados)) return dados.map((v) => `- ${formatDados(v, indent + "  ")}`).join("\n");
  const lines: string[] = [];
  for (const [k, v] of Object.entries(dados as Record<string, unknown>)) {
    if (typeof v === "string" && v.startsWith("http") && /\.(png|jpe?g|webp)/i.test(v)) {
      lines.push(`${indent}- ${k}: (foto enviada)`);
      continue;
    }
    if (v && typeof v === "object") {
      lines.push(`${indent}- ${k}:`);
      lines.push(formatDados(v, indent + "  "));
    } else {
      const valor = v === null || v === undefined || v === "" ? "(não respondido)" : String(v);
      lines.push(`${indent}- ${k}: ${valor}`);
    }
  }
  return lines.join("\n");
}

export async function gerarMensagemIA(
  promptTipo: "feedback_quinzenal" | "feedback_mensal",
  alunoId: string,
): Promise<{ mensagem: string | null; error: string | null }> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return { mensagem: null, error: "LOVABLE_API_KEY ausente" };

  const { data: form } = await supabaseAdmin
    .from("formularios")
    .select("dados_resposta, respondido_em")
    .eq("aluno_id", alunoId)
    .eq("tipo", promptTipo)
    .eq("respondido", true)
    .order("respondido_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!form?.dados_resposta) return { mensagem: null, error: "Sem resposta" };

  const [{ data: aluno }, { data: promptRow }] = await Promise.all([
    supabaseAdmin.from("alunos").select("nome").eq("id", alunoId).maybeSingle(),
    supabaseAdmin.from("prompts_ia").select("prompt_sistema").eq("tipo", promptTipo).maybeSingle(),
  ]);
  if (!aluno) return { mensagem: null, error: "Aluno não encontrado" };

  const rawPrompt = promptRow?.prompt_sistema?.trim()
    || `Você é um assistente que responde feedback de aluno. Seja claro e motivador.`;

  const respostasFmt = formatDados(form.dados_resposta);
  const nomeCurto = primeiroNome(aluno.nome);
  const vars: Record<string, string> = { nome_aluno: nomeCurto, respostas: respostasFmt };
  const systemPrompt = rawPrompt.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k) => vars[k] ?? `{{${k}}}`);
  const userContent = `Nome do aluno: ${nomeCurto}\n\nRespostas:\n${respostasFmt}`;

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
      }),
    });
    if (!resp.ok) {
      const t = await resp.text();
      return { mensagem: null, error: `AI gateway ${resp.status}: ${t.slice(0, 200)}` };
    }
    const json = await resp.json();
    const mensagem = json?.choices?.[0]?.message?.content?.trim() ?? null;
    return { mensagem, error: mensagem ? null : "Resposta vazia" };
  } catch (e) {
    return { mensagem: null, error: e instanceof Error ? e.message : "Falha AI gateway" };
  }
}

export async function processarJobsRespostaFeedbackImpl() {
  const { data: jobs, error } = await supabaseAdmin
    .from("jobs_disparos")
    .select("id, aluno_id, tipo, agendado_para")
    .in("tipo", TIPOS_RESPOSTA as unknown as any)
    .eq("executado", false)
    .lte("agendado_para", new Date().toISOString())
    .limit(50);
  if (error) return { ok: false, processados: 0, error: error.message };

  let processados = 0;
  const erros: Array<{ jobId: string; error: string }> = [];

  for (const job of jobs ?? []) {
    if (!job.aluno_id) {
      await supabaseAdmin
        .from("jobs_disparos")
        .update({ executado: true, executado_em: new Date().toISOString(), erro: "sem aluno" })
        .eq("id", job.id);
      continue;
    }

    let mensagem: string | null = null;
    const tipoJob = job.tipo as TipoJob;
    let errIA: string | null = null;

    if (tipoJob === "feedback_mensal_resposta") {
      const r = await gerarMensagemIA("feedback_mensal", job.aluno_id);
      mensagem = r.mensagem; errIA = r.error;
    } else if (tipoJob === "pos_feedback_mensal") {
      mensagem = MSG_PRAZO_3_DIAS_UTEIS;
    }

    if (!mensagem) {
      erros.push({ jobId: job.id, error: errIA ?? "mensagem vazia" });
      await supabaseAdmin
        .from("jobs_disparos")
        .update({
          tentativas: 999,
          erro: errIA ?? "mensagem vazia",
        })
        .eq("id", job.id);
      continue;
    }

    const envio = await enviarWhatsAppTeste({
      alunoId: job.aluno_id,
      tipoJob,
      mensagem,
    });

    await supabaseAdmin
      .from("jobs_disparos")
      .update({
        executado: envio.ok,
        executado_em: envio.ok ? new Date().toISOString() : null,
        erro: envio.error,
        tentativas: envio.ok ? 1 : 999,
      })
      .eq("id", job.id);

    if (envio.ok) processados += 1;
    else erros.push({ jobId: job.id, error: envio.error ?? "erro" });
  }

  return { ok: true, processados, erros };
}
