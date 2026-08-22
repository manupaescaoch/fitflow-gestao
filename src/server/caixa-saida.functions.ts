import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { enviarWhatsAppTeste } from "./zapi-send.server";

/**
 * Caixa de Saída unificada:
 *  - jobs_disparos pendentes (motor)
 *  - mensagens_log com status_envio = 'pendente' (resposta IA aguardando revisão)
 */

export type CaixaItem = {
  origem: "job" | "ia_pendente";
  id: string;
  aluno_id: string | null;
  aluno_nome: string | null;
  aluno_whatsapp: string | null;
  tipo: string;
  agendado_para: string | null;   // jobs_disparos
  criado_em: string;              // mensagens_log
  mensagem: string | null;        // só preenchida quando origem = ia_pendente
  atrasado: boolean;
};

export const listCaixaSaida = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async () => {
  const agora = Date.now();

  const [{ data: jobs }, { data: pendentes }] = await Promise.all([
    supabaseAdmin
      .from("jobs_disparos")
      .select("id, aluno_id, tipo, agendado_para, criado_em")
      .eq("executado", false)
      .order("agendado_para", { ascending: true })
      .limit(300),
    supabaseAdmin
      .from("mensagens_log")
      .select("id, aluno_id, tipo_job, mensagem_enviada, enviado_em")
      .eq("status_envio", "pendente" as any)
      .order("enviado_em", { ascending: false })
      .limit(300),
  ]);

  const ids = new Set<string>();
  (jobs ?? []).forEach((j) => j.aluno_id && ids.add(j.aluno_id));
  (pendentes ?? []).forEach((m) => m.aluno_id && ids.add(m.aluno_id));

  const alunosMap = new Map<string, { nome: string; whatsapp: string | null }>();
  if (ids.size > 0) {
    const { data: alunos } = await supabaseAdmin
      .from("alunos")
      .select("id, nome, whatsapp")
      .in("id", Array.from(ids));
    (alunos ?? []).forEach((a) => alunosMap.set(a.id, { nome: a.nome, whatsapp: a.whatsapp }));
  }

  const itens: CaixaItem[] = [];

  for (const j of jobs ?? []) {
    const aluno = j.aluno_id ? alunosMap.get(j.aluno_id) : null;
    itens.push({
      origem: "job",
      id: j.id,
      aluno_id: j.aluno_id,
      aluno_nome: aluno?.nome ?? null,
      aluno_whatsapp: aluno?.whatsapp ?? null,
      tipo: j.tipo,
      agendado_para: j.agendado_para,
      criado_em: j.criado_em,
      mensagem: null,
      atrasado: new Date(j.agendado_para).getTime() < agora - 2 * 60 * 1000,
    });
  }

  for (const m of pendentes ?? []) {
    const aluno = m.aluno_id ? alunosMap.get(m.aluno_id) : null;
    itens.push({
      origem: "ia_pendente",
      id: m.id,
      aluno_id: m.aluno_id,
      aluno_nome: aluno?.nome ?? null,
      aluno_whatsapp: aluno?.whatsapp ?? null,
      tipo: m.tipo_job ?? "Resposta IA",
      agendado_para: null,
      criado_em: m.enviado_em,
      mensagem: m.mensagem_enviada,
      atrasado: false,
    });
  }

  return { itens };
});

export const aprovarMensagemIA = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; mensagem?: string }) => {
    if (!d?.id) throw new Error("id obrigatório");
    return d;
  })
  .handler(async ({ data }) => {
    const { data: row } = await supabaseAdmin
      .from("mensagens_log")
      .select("aluno_id, tipo_job, mensagem_enviada")
      .eq("id", data.id)
      .maybeSingle();
    if (!row?.aluno_id) return { ok: false, error: "Mensagem não encontrada" };

    const texto = (data.mensagem ?? row.mensagem_enviada ?? "").trim();
    if (!texto) return { ok: false, error: "Mensagem vazia" };

    const r = await enviarWhatsAppTeste({
      alunoId: row.aluno_id,
      tipoJob: row.tipo_job ?? "ia_aprovada",
      mensagem: texto,
    });

    // Marca como descartada para sair da fila (o envio já gerou outra linha enviada/erro)
    await supabaseAdmin
      .from("mensagens_log")
      .update({ status_envio: "descartado" as any })
      .eq("id", data.id);

    return { ok: r.ok, error: r.error };
  });

export const descartarMensagemIA = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => {
    if (!d?.id) throw new Error("id obrigatório");
    return d;
  })
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("mensagens_log")
      .update({ status_envio: "descartado" as any })
      .eq("id", data.id);
    return { ok: !error, error: error?.message ?? null };
  });

/**
 * KPIs da Caixa de Saída — saúde do motor em 1 olhada.
 */
export const getCaixaSaidaKpis = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async () => {
  const agora = new Date();
  const h24 = new Date(agora.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const atrasoLimite = new Date(agora.getTime() - 2 * 60 * 1000).toISOString();
  const nowIso = agora.toISOString();

  const [agendados, atrasados, executados24h, comErro24h] = await Promise.all([
    supabaseAdmin
      .from("jobs_disparos")
      .select("id", { count: "exact", head: true })
      .eq("executado", false)
      .is("erro", null)
      .gt("agendado_para", nowIso),
    supabaseAdmin
      .from("jobs_disparos")
      .select("id", { count: "exact", head: true })
      .eq("executado", false)
      .lt("agendado_para", atrasoLimite),
    supabaseAdmin
      .from("jobs_disparos")
      .select("id", { count: "exact", head: true })
      .eq("executado", true)
      .gte("executado_em", h24),
    supabaseAdmin
      .from("jobs_disparos")
      .select("id", { count: "exact", head: true })
      .not("erro", "is", null)
      .gte("criado_em", h24),
  ]);

  return {
    agendados: agendados.count ?? 0,
    atrasados: atrasados.count ?? 0,
    executados24h: executados24h.count ?? 0,
    comErro24h: comErro24h.count ?? 0,
  };
});

/**
 * Erros recentes (48h) agrupados por tipo, com último aluno afetado.
 */
export type ErroPorTipo = {
  tipo: string;
  qtd: number;
  ultimo_erro: string;
  ultimo_em: string;
  ultimo_aluno_id: string | null;
  ultimo_aluno_nome: string | null;
};

export const getErrosRecentesPorTipo = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async (): Promise<ErroPorTipo[]> => {
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const { data: jobs } = await supabaseAdmin
    .from("jobs_disparos")
    .select("tipo, erro, criado_em, aluno_id")
    .not("erro", "is", null)
    .gte("criado_em", since)
    .order("criado_em", { ascending: false })
    .limit(500);

  const lista = (jobs ?? []).filter((j) => (j.erro ?? "").trim().length > 0);

  // Carrega nomes
  const ids = Array.from(new Set(lista.map((j) => j.aluno_id).filter(Boolean) as string[]));
  const nomes = new Map<string, string>();
  if (ids.length > 0) {
    const { data: alunos } = await supabaseAdmin
      .from("alunos")
      .select("id, nome")
      .in("id", ids);
    (alunos ?? []).forEach((a) => nomes.set(a.id, a.nome));
  }

  const grupos = new Map<string, ErroPorTipo>();
  for (const j of lista) {
    const existente = grupos.get(j.tipo as string);
    if (existente) {
      existente.qtd += 1;
      continue;
    }
    grupos.set(j.tipo as string, {
      tipo: j.tipo as string,
      qtd: 1,
      ultimo_erro: j.erro ?? "",
      ultimo_em: j.criado_em,
      ultimo_aluno_id: j.aluno_id,
      ultimo_aluno_nome: j.aluno_id ? nomes.get(j.aluno_id) ?? null : null,
    });
  }

  return Array.from(grupos.values()).sort((a, b) => b.qtd - a.qtd);
});