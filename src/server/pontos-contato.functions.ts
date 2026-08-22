import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { primeiroNome } from "@/lib/nome";

export const gerarMensagemPontoContato = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((data: { pontoId: string; alunoId?: string | null }) => {
    if (!data?.pontoId) throw new Error("pontoId obrigatório");
    return data;
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return { mensagem: null as string | null, error: "OPENAI_API_KEY não configurado" };

    const { data: ponto, error: pErr } = await supabaseAdmin
      .from("pontos_contato")
      .select("id, nome, prompt_tipo")
      .eq("id", data.pontoId)
      .maybeSingle();
    if (pErr || !ponto) return { mensagem: null, error: "Ponto de contato não encontrado" };

    const { data: promptRow } = await supabaseAdmin
      .from("prompts_ia")
      .select("prompt_sistema")
      .eq("tipo", ponto.prompt_tipo)
      .maybeSingle();
    const rawPrompt = promptRow?.prompt_sistema?.trim()
      || `Você escreve mensagens curtas e motivadoras para alunos de consultoria. Seja direto e caloroso.`;

    let nomeAluno = "Aluno exemplo";
    if (data.alunoId) {
      const { data: a } = await supabaseAdmin.from("alunos").select("nome").eq("id", data.alunoId).maybeSingle();
      if (a?.nome) nomeAluno = a.nome;
    } else {
      const { data: a } = await supabaseAdmin.from("alunos").select("nome").eq("status", "ativo").order("criado_em", { ascending: false }).limit(1).maybeSingle();
      if (a?.nome) nomeAluno = a.nome;
    }

    const nomeCurto = primeiroNome(nomeAluno) || nomeAluno;
    const vars: Record<string, string> = { nome_aluno: nomeCurto };
    const systemPrompt = rawPrompt.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k) => vars[k] ?? `{{${k}}}`);
    const guardrail = "\n\nIMPORTANTE: Escreva a mensagem final pronta para envio. NÃO use placeholders, variáveis entre chaves (ex: {{algo}}), colchetes [algo] ou texto a preencher. Se não souber um dado específico, reescreva a frase de forma genérica.";
    const finalSystemPrompt = systemPrompt + guardrail;

    try {
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: finalSystemPrompt },
            { role: "user", content: `Gere a mensagem de WhatsApp para ${nomeCurto}.` },
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
      return { mensagem, error: null, nomeAluno };
    } catch (e) {
      console.error("OpenAI fetch failed", e);
      return { mensagem: null, error: "Falha ao chamar a OpenAI" };
    }
  });

function onlyDigits(s: string | null | undefined) {
  return (s || "").replace(/\D/g, "");
}

/**
 * Gera (ou reusa) a mensagem do ponto de contato e envia via Z-API
 * para o WhatsApp do aluno. Grava em mensagens_log e atualiza
 * pontos_contato.ultimo_envio_em / total_envios.
 */
export const enviarPontoContatoZapi = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((data: { pontoId: string; alunoId: string; mensagem?: string | null }) => {
    if (!data?.pontoId) throw new Error("pontoId obrigatório");
    if (!data?.alunoId) throw new Error("alunoId obrigatório");
    return data;
  })
  .handler(async ({ data }) => {
    const instance = process.env.ZAPI_INSTANCE_ID || process.env.ZAPI_INSTANCE;
    const token = process.env.ZAPI_TOKEN;
    const clientToken = process.env.ZAPI_CLIENT_TOKEN;
    if (!instance || !token || !clientToken) {
      return { ok: false, error: "Z-API não configurada" };
    }

    const { data: aluno } = await supabaseAdmin
      .from("alunos")
      .select("id, nome, whatsapp")
      .eq("id", data.alunoId)
      .maybeSingle();
    if (!aluno) return { ok: false, error: "Aluno não encontrado" };

    const phone = onlyDigits(aluno.whatsapp);
    if (phone.length < 10) return { ok: false, error: "WhatsApp inválido" };

    const { data: ponto } = await supabaseAdmin
      .from("pontos_contato")
      .select("id, nome, prompt_tipo, total_envios")
      .eq("id", data.pontoId)
      .maybeSingle();
    if (!ponto) return { ok: false, error: "Ponto de contato não encontrado" };

    let mensagem = (data.mensagem || "").trim();
    if (!mensagem) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) return { ok: false, error: "OPENAI_API_KEY não configurado" };

      const { data: promptRow } = await supabaseAdmin
        .from("prompts_ia")
        .select("prompt_sistema")
        .eq("tipo", ponto.prompt_tipo)
        .maybeSingle();
      const rawPrompt = promptRow?.prompt_sistema?.trim()
        || `Você escreve mensagens curtas e motivadoras para alunos de consultoria. Seja direto e caloroso.`;
      const nomeCurto = primeiroNome(aluno.nome);
      const vars: Record<string, string> = { nome_aluno: nomeCurto };
      const systemPrompt = rawPrompt.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k) => vars[k] ?? `{{${k}}}`);
      const guardrail = "\n\nIMPORTANTE: Escreva a mensagem final pronta para envio. NÃO use placeholders, variáveis entre chaves (ex: {{algo}}), colchetes [algo] ou texto a preencher. Se não souber um dado específico, reescreva a frase de forma genérica.";
      const finalSystemPrompt = systemPrompt + guardrail;

      const aiResp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: finalSystemPrompt },
            { role: "user", content: `Gere a mensagem de WhatsApp para ${nomeCurto}.` },
          ],
        }),
      });
      if (!aiResp.ok) {
        const t = await aiResp.text();
        console.error("OpenAI error", aiResp.status, t);
        return { ok: false, error: `Falha IA (${aiResp.status})` };
      }
      const j = await aiResp.json();
      mensagem = j?.choices?.[0]?.message?.content?.trim() ?? "";
      if (!mensagem) return { ok: false, error: "IA retornou mensagem vazia" };
    }

    const url = `https://api.z-api.io/instances/${instance}/token/${token}/send-text`;
    let zapiOk = false;
    let zapiErr: string | null = null;
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Client-Token": clientToken },
        body: JSON.stringify({ phone, message: mensagem }),
      });
      const txt = await r.text();
      if (!r.ok) {
        zapiErr = `Z-API ${r.status}: ${txt.slice(0, 200)}`;
      } else {
        zapiOk = true;
      }
    } catch (e) {
      zapiErr = e instanceof Error ? e.message : "Falha Z-API";
    }

    await supabaseAdmin.from("mensagens_log").insert({
      aluno_id: aluno.id,
      tipo_job: ponto.prompt_tipo,
      mensagem_enviada: mensagem,
      whatsapp_destino: phone,
      status_envio: zapiOk ? "enviado" : "erro",
      erro_detalhe: zapiErr,
    });

    if (zapiOk) {
      await supabaseAdmin
        .from("pontos_contato")
        .update({
          ultimo_envio_em: new Date().toISOString(),
          total_envios: (ponto.total_envios ?? 0) + 1,
        })
        .eq("id", ponto.id);
    }

    return { ok: zapiOk, error: zapiErr, mensagem };
  });