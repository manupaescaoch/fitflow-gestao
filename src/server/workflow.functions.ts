import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { lerCredencial } from "./credenciais.server";

const PROMPT_TIPOS = ["anamnese", "feedback_quinzenal", "feedback_mensal", "check_shape_mensal", "followup_d7", "followup_d21", "estrategia_treino", "estrategia_nutricional"] as const;
type PromptTipo = (typeof PROMPT_TIPOS)[number];

export const getWorkflowConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("workflow_config")
      .select("chave, valor, tipo, secao, atualizado_em, atualizado_por");
    if (error) throw new Error(error.message);

    const ultimosUserIds = Array.from(new Set((data ?? []).map((r) => r.atualizado_por).filter(Boolean))) as string[];
    let usersMap: Record<string, string> = {};
    if (ultimosUserIds.length) {
      const { data: us } = await supabaseAdmin.from("usuarios_crm").select("id, nome, email").in("id", ultimosUserIds);
      (us ?? []).forEach((u: any) => { usersMap[u.id] = u.nome ?? u.email ?? "—"; });
    }

    return {
      itens: (data ?? []).map((r) => ({
        chave: r.chave,
        valor: r.valor,
        tipo: r.tipo,
        secao: r.secao,
        atualizado_em: r.atualizado_em,
        atualizado_por_nome: r.atualizado_por ? usersMap[r.atualizado_por as string] ?? "—" : null,
      })),
    };
  });

export const saveWorkflowConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { secao: "motor" | "ciclo" | "mensagens" | "ia" | "lembretes" | "renovacao"; valores: Record<string, string> }) => {
    if (!data?.secao) throw new Error("seção obrigatória");
    if (!data.valores || typeof data.valores !== "object") throw new Error("valores obrigatórios");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const updates = Object.entries(data.valores);
    for (const [chave, valor] of updates) {
      const { error } = await supabaseAdmin
        .from("workflow_config")
        .update({ valor, atualizado_por: userId })
        .eq("chave", chave)
        .eq("secao", data.secao);
      if (error) throw new Error(`Falha ao salvar ${chave}: ${error.message}`);
    }
    return { ok: true };
  });

export const getPromptsIA = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data, error } = await supabaseAdmin
      .from("prompts_ia")
      .select("tipo, prompt_sistema, atualizado_em")
      .in("tipo", PROMPT_TIPOS as unknown as any);
    if (error) throw new Error(error.message);
    return { prompts: data ?? [] };
  });

export const savePromptIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { tipo: PromptTipo; prompt_sistema: string }) => {
    if (!PROMPT_TIPOS.includes(data?.tipo)) throw new Error("tipo inválido");
    if (typeof data.prompt_sistema !== "string") throw new Error("prompt obrigatório");
    return data;
  })
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("prompts_ia")
      .upsert({ tipo: data.tipo as any, prompt_sistema: data.prompt_sistema, ativo: true }, { onConflict: "tipo" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const testarPromptIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { prompt_sistema: string; exemplo?: string }) => {
    if (!data?.prompt_sistema) throw new Error("prompt obrigatório");
    return data;
  })
  .handler(async ({ data }) => {
    const apiKey = (await lerCredencial("OPENAI_API_KEY"));
    if (!apiKey) return { ok: false, resposta: null, error: "OPENAI_API_KEY não configurado" };
    const exemplo = data.exemplo?.trim() || "Aluno exemplo: João, plano de 30 dias, foco em hipertrofia.";
    try {
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: data.prompt_sistema },
            { role: "user", content: exemplo },
          ],
        }),
      });
      if (!resp.ok) {
        const t = await resp.text();
        return { ok: false, resposta: null, error: `Erro OpenAI (${resp.status}): ${t.slice(0, 200)}` };
      }
      const json = await resp.json();
      return { ok: true, resposta: json?.choices?.[0]?.message?.content ?? "", error: null };
    } catch (e) {
      return { ok: false, resposta: null, error: e instanceof Error ? e.message : "Falha ao chamar OpenAI" };
    }
  });

export const getResumoDisparos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const { count: enviadosHoje } = await supabaseAdmin
      .from("jobs_disparos")
      .select("*", { count: "exact", head: true })
      .eq("executado", true)
      .gte("executado_em", hoje.toISOString());
    const { count: errosPendentes } = await supabaseAdmin
      .from("jobs_disparos")
      .select("*", { count: "exact", head: true })
      .eq("executado", false)
      .not("erro", "is", null);
    const { data: prox } = await supabaseAdmin
      .from("jobs_disparos")
      .select("agendado_para, tipo")
      .eq("executado", false)
      .order("agendado_para", { ascending: true })
      .limit(1)
      .maybeSingle();
    return {
      enviadosHoje: enviadosHoje ?? 0,
      errosPendentes: errosPendentes ?? 0,
      proximo: prox ?? null,
    };
  });

export const getHistoricoDisparos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { tipo?: string; status?: "todos" | "enviado" | "erro" | "pendente"; busca?: string; page?: number }) => data ?? {})
  .handler(async ({ data }) => {
    const page = Math.max(1, data.page ?? 1);
    const from = (page - 1) * 20;
    const to = from + 19;
    let q = supabaseAdmin
      .from("jobs_disparos")
      .select("id, tipo, agendado_para, executado, executado_em, erro, tentativas, aluno_id", { count: "exact" })
      .order("agendado_para", { ascending: false })
      .range(from, to);
    if (data.tipo && data.tipo !== "todos") q = q.eq("tipo", data.tipo as any);
    if (data.status === "enviado") q = q.eq("executado", true);
    if (data.status === "erro") q = q.eq("executado", false).not("erro", "is", null);
    if (data.status === "pendente") q = q.eq("executado", false).is("erro", null);
    const { data: rows, error, count } = await q;
    if (error) throw new Error(error.message);
    const alunoIds = Array.from(new Set((rows ?? []).map((r) => r.aluno_id).filter(Boolean))) as string[];
    let alunosMap: Record<string, string> = {};
    if (alunoIds.length) {
      const { data: as } = await supabaseAdmin.from("alunos").select("id, nome").in("id", alunoIds);
      (as ?? []).forEach((a: any) => { alunosMap[a.id] = a.nome; });
    }
    let filtered = (rows ?? []).map((r) => ({ ...r, aluno_nome: r.aluno_id ? alunosMap[r.aluno_id as string] ?? "—" : "—" }));
    if (data.busca?.trim()) {
      const b = data.busca.toLowerCase();
      filtered = filtered.filter((r) => r.aluno_nome.toLowerCase().includes(b));
    }
    return { rows: filtered, total: count ?? 0, page };
  });

export const reenviarJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { jobId: string }) => {
    if (!data?.jobId) throw new Error("jobId obrigatório");
    return data;
  })
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("jobs_disparos")
      .update({ executado: false, erro: null, agendado_para: new Date().toISOString() })
      .eq("id", data.jobId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });