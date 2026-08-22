import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ISO = (s?: string | null) => (s && s.length ? s : null);

export const getIndicadores = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((data: { from?: string; to?: string }) => ({
    from: ISO(data?.from) || new Date(Date.now() - 30 * 86400_000).toISOString(),
    to: ISO(data?.to) || new Date().toISOString(),
  }))
  .handler(async ({ data }) => {
    const sb = supabaseAdmin;
    const in7 = new Date(Date.now() + 7 * 86400_000).toISOString();
    const today = new Date().toISOString();

    const [
      msgTotal,
      msgFalhas,
      feedbacks,
      renovacoesProx,
      fotosProblema,
      precisamResign,
    ] = await Promise.all([
      sb.from("mensagens_log").select("id", { count: "exact", head: true })
        .gte("enviado_em", data.from).lte("enviado_em", data.to),
      sb.from("mensagens_log").select("id", { count: "exact", head: true })
        .gte("enviado_em", data.from).lte("enviado_em", data.to)
        .eq("status_envio", "erro"),
      sb.from("formularios").select("id", { count: "exact", head: true })
        .eq("respondido", true).in("tipo", ["feedback_quinzenal", "feedback_mensal", "anamnese"])
        .gte("respondido_em", data.from).lte("respondido_em", data.to),
      sb.from("alunos").select("id", { count: "exact", head: true })
        .eq("status", "ativo").lte("data_expiracao", in7).gte("data_expiracao", today),
      sb.from("photo_audit_logs").select("id", { count: "exact", head: true })
        .in("url_status", ["expirada", "rejeitada", "sem_assinatura", "erro_403", "erro_404", "invalida"])
        .eq("resolved", false),
      sb.from("photo_audit_logs").select("aluno_id", { count: "exact", head: true })
        .eq("needs_resign", true).eq("resolved", false),
    ]);

    return {
      mensagensEnviadas: msgTotal.count ?? 0,
      falhasEnvio: msgFalhas.count ?? 0,
      feedbacksPreenchidos: feedbacks.count ?? 0,
      renovacoesProximas: renovacoesProx.count ?? 0,
      fotosComProblema: fotosProblema.count ?? 0,
      alunosResign: precisamResign.count ?? 0,
    };
  });

export const listMensagens = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: {
    from?: string; to?: string; alunoId?: string; status?: string;
    tipo?: string; search?: string; onlyErrors?: boolean; limit?: number;
  }) => d || {})
  .handler(async ({ data }) => {
    const sb = supabaseAdmin;
    let q = sb.from("mensagens_log").select("id, aluno_id, whatsapp_destino, mensagem_enviada, tipo_job, status_envio, erro_detalhe, enviado_em")
      .order("enviado_em", { ascending: false })
      .limit(data.limit ?? 200);
    if (data.from) q = q.gte("enviado_em", data.from);
    if (data.to) q = q.lte("enviado_em", data.to);
    if (data.alunoId) q = q.eq("aluno_id", data.alunoId);
    if (data.status) q = q.eq("status_envio", data.status as any);
    if (data.tipo) q = q.eq("tipo_job", data.tipo);
    if (data.onlyErrors) q = q.eq("status_envio", "erro");
    const { data: rows, error } = await q;
    if (error) return { rows: [], error: error.message };

    // Hidrata nomes de alunos
    const ids = Array.from(new Set((rows ?? []).map((r) => r.aluno_id).filter(Boolean))) as string[];
    let nomeMap: Record<string, string> = {};
    if (ids.length) {
      const { data: alunos } = await sb.from("alunos").select("id, nome").in("id", ids);
      nomeMap = Object.fromEntries((alunos ?? []).map((a) => [a.id, a.nome]));
    }

    const enriched = (rows ?? []).map((r) => ({
      ...r,
      aluno_nome: r.aluno_id ? nomeMap[r.aluno_id] || "—" : "—",
    }));
    if (data.search) {
      const q = data.search.toLowerCase();
      return { rows: enriched.filter((r) => (r.aluno_nome || "").toLowerCase().includes(q)), error: null };
    }
    return { rows: enriched, error: null };
  });

export const listHistoricoStatus = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: { from?: string; to?: string; alunoId?: string; status?: string; search?: string; limit?: number }) => d || {})
  .handler(async ({ data }) => {
    const sb = supabaseAdmin;
    let q = sb.from("historico_status")
      .select("id, aluno_id, status_de, status_para, alterado_por, criado_em")
      .order("criado_em", { ascending: false })
      .limit(data.limit ?? 300);
    if (data.from) q = q.gte("criado_em", data.from);
    if (data.to) q = q.lte("criado_em", data.to);
    if (data.alunoId) q = q.eq("aluno_id", data.alunoId);
    if (data.status) q = q.eq("status_para", data.status);
    const { data: rows, error } = await q;
    if (error) return { rows: [], error: error.message };

    const ids = Array.from(new Set((rows ?? []).map((r) => r.aluno_id).filter(Boolean))) as string[];
    let nomeMap: Record<string, string> = {};
    if (ids.length) {
      const { data: alunos } = await sb.from("alunos").select("id, nome").in("id", ids);
      nomeMap = Object.fromEntries((alunos ?? []).map((a) => [a.id, a.nome]));
    }
    const enriched = (rows ?? []).map((r) => ({ ...r, aluno_nome: r.aluno_id ? nomeMap[r.aluno_id] || "—" : "—" }));
    if (data.search) {
      const s = data.search.toLowerCase();
      return { rows: enriched.filter((r) => (r.aluno_nome || "").toLowerCase().includes(s)), error: null };
    }
    return { rows: enriched, error: null };
  });

export const listRenovacoes = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: { status?: string; search?: string }) => d || {})
  .handler(async ({ data }) => {
    const sb = supabaseAdmin;
    const { data: alunos, error } = await sb
      .from("alunos")
      .select("id, nome, plano, data_d0, data_expiracao, status, renovado, total_renovacoes, valor_plano")
      .not("data_expiracao", "is", null)
      .order("data_expiracao", { ascending: true })
      .limit(500);
    if (error) return { rows: [], error: error.message };

    const now = Date.now();
    const rows = (alunos ?? []).map((a) => {
      const exp = a.data_expiracao ? new Date(a.data_expiracao).getTime() : null;
      const dias = exp ? Math.ceil((exp - now) / 86400_000) : null;
      let renewal_status: string;
      if (a.renovado) renewal_status = "renovado";
      else if (a.status === "cancelado") renewal_status = "cancelado";
      else if (dias === null) renewal_status = "indefinido";
      else if (dias < 0) renewal_status = "vencido";
      else if (dias === 0) renewal_status = "vence_hoje";
      else if (dias <= 7) renewal_status = "proximo_vencimento";
      else renewal_status = "em_dia";
      return { ...a, dias_restantes: dias, renewal_status };
    });

    let filtered = rows;
    if (data.status) filtered = filtered.filter((r) => r.renewal_status === data.status);
    if (data.search) {
      const s = data.search.toLowerCase();
      filtered = filtered.filter((r) => (r.nome || "").toLowerCase().includes(s));
    }
    return { rows: filtered, error: null };
  });

export const listFeedbacks = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: { from?: string; to?: string; tipo?: string; alunoId?: string; search?: string; limit?: number; status?: string }) => d || {})
  .handler(async ({ data }) => {
    const sb = supabaseAdmin;
    const status = data.status || "respondidos";
    let q = sb.from("formularios")
      .select("id, aluno_id, tipo, respondido, respondido_em, recebido_em, link_publico, confirmado_equipe, confirmado_em, confirmado_por, origem, criado_em")
      .limit(data.limit ?? 300);

    const nowIso = new Date().toISOString();
    const expDays = 14; // formulário considerado expirado após 14 dias sem resposta
    const expCut = new Date(Date.now() - expDays * 86400_000).toISOString();

    if (status === "respondidos") {
      q = q.eq("respondido", true).order("respondido_em", { ascending: false });
      if (data.from) q = q.gte("respondido_em", data.from);
      if (data.to) q = q.lte("respondido_em", data.to);
    } else if (status === "pendentes") {
      q = q.eq("respondido", false).gte("criado_em", expCut).order("criado_em", { ascending: false });
      if (data.from) q = q.gte("criado_em", data.from);
      if (data.to) q = q.lte("criado_em", data.to);
    } else if (status === "expirados") {
      q = q.eq("respondido", false).lt("criado_em", expCut).order("criado_em", { ascending: false });
      if (data.from) q = q.gte("criado_em", data.from);
      if (data.to) q = q.lte("criado_em", data.to);
    } else {
      // todos
      q = q.order("criado_em", { ascending: false });
      if (data.from) q = q.gte("criado_em", data.from);
      if (data.to) q = q.lte("criado_em", data.to);
    }

    if (data.tipo) q = q.eq("tipo", data.tipo as any);
    if (data.alunoId) q = q.eq("aluno_id", data.alunoId);
    const { data: rows, error } = await q;
    if (error) return { rows: [], error: error.message };

    const ids = Array.from(new Set((rows ?? []).map((r) => r.aluno_id).filter(Boolean))) as string[];
    let nomeMap: Record<string, string> = {};
    if (ids.length) {
      const { data: alunos } = await sb.from("alunos").select("id, nome").in("id", ids);
      nomeMap = Object.fromEntries((alunos ?? []).map((a) => [a.id, a.nome]));
    }

    // Erros técnicos de foto por formulário (se for anamnese)
    const formIds = (rows ?? []).map((r) => r.id);
    let erroFotoMap: Record<string, number> = {};
    if (formIds.length) {
      const { data: fotos } = await sb
        .from("photo_audit_logs")
        .select("formulario_id, url_status, resolved")
        .in("formulario_id", formIds)
        .in("url_status", ["erro", "rejeitada"])
        .eq("resolved", false);
      for (const f of fotos ?? []) {
        if (!f.formulario_id) continue;
        erroFotoMap[f.formulario_id] = (erroFotoMap[f.formulario_id] || 0) + 1;
      }
    }

    const enriched = (rows ?? []).map((r) => {
      const erros = erroFotoMap[r.id] || 0;
      let situacao: "respondido" | "pendente" | "expirado" | "erro_foto" = "pendente";
      if (r.respondido) situacao = "respondido";
      else if (r.criado_em && r.criado_em < expCut) situacao = "expirado";
      if (erros > 0 && r.respondido) situacao = "erro_foto";
      return {
        ...r,
        aluno_nome: r.aluno_id ? nomeMap[r.aluno_id] || "—" : "—",
        analysis_status: r.confirmado_equipe ? "respondido" : "pendente",
        situacao,
        erros_foto: erros,
        data_evento: r.respondido_em || r.criado_em,
      };
    });

    let final = enriched;
    if (status === "erro_foto") {
      final = enriched.filter((r) => r.erros_foto > 0);
    }

    if (data.search) {
      const s = data.search.toLowerCase();
      return { rows: final.filter((r) => (r.aluno_nome || "").toLowerCase().includes(s)), error: null };
    }
    return { rows: final, error: null };
  });

export const marcarFeedbackAnalisado = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => {
    if (!d?.id) throw new Error("id obrigatório");
    return d;
  })
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("formularios")
      .update({ confirmado_equipe: true, confirmado_em: new Date().toISOString() })
      .eq("id", data.id);
    return { ok: !error, error: error?.message ?? null };
  });

export const marcarRenovado = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: { alunoId: string }) => {
    if (!d?.alunoId) throw new Error("alunoId obrigatório");
    return d;
  })
  .handler(async ({ data }) => {
    const { data: aluno } = await supabaseAdmin.from("alunos").select("total_renovacoes, prazo_dias").eq("id", data.alunoId).maybeSingle();
    const novaExp = new Date(Date.now() + (aluno?.prazo_dias ?? 30) * 86400_000).toISOString();
    const { error } = await supabaseAdmin.from("alunos").update({
      renovado: true,
      total_renovacoes: (aluno?.total_renovacoes ?? 0) + 1,
      data_expiracao: novaExp,
    }).eq("id", data.alunoId);
    return { ok: !error, error: error?.message ?? null };
  });
