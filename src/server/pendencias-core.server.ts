import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type TipoPendencia = "feedback_mensal" | "feedback_quinzenal";

export type StatusAtendimento = "pendente" | "enviado_manual" | "resolvido";

export type PendenciaItem = {
  key: string;
  aluno_id: string;
  aluno_nome: string;
  whatsapp: string;
  unidade: string | null;
  plano: string | null;
  status_plano: string;
  tipo: TipoPendencia;
  data_prevista: string;
  dias_atraso: number;
  motivo_erro: string | null;
  job_id: string | null;
  status_atendimento: StatusAtendimento;
  responsavel_nome: string | null;
  responsavel_id: string | null;
  acao_em: string | null;
  observacao: string | null;
};

export type PendenciasFiltro = {
  unidade?: string | null;
  tipo?: TipoPendencia | null;
  status?: StatusAtendimento | null;
  de?: string | null;
  ate?: string | null;
  responsavel?: string | null;
};

export type PendenciasResultado = {
  itens: PendenciaItem[];
  indicadores: {
    total: number;
    mensais: number;
    quinzenais: number;
    enviosManuaisHoje: number;
    porUnidade: Array<{ unidade: string; total: number }>;
  };
  responsaveis: Array<{ id: string; nome: string }>;
};

const CICLO_DIAS: Record<TipoPendencia, number> = {
  feedback_quinzenal: 15,
  feedback_mensal: 30,
};
const JOB_POR_TIPO: Record<TipoPendencia, string> = {
  feedback_quinzenal: "feedback_quinzenal_link",
  feedback_mensal: "feedback_mensal_link",
};
const TIPO_POR_JOB: Record<string, TipoPendencia> = {
  feedback_quinzenal_link: "feedback_quinzenal",
  feedback_mensal_link: "feedback_mensal",
};

const DIA_MS = 86400000;

function diasEntre(a: number, b: number): number {
  return Math.max(0, Math.floor((a - b) / DIA_MS));
}

function inicioHojeBRT(now = new Date()): Date {
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  brt.setUTCHours(0, 0, 0, 0);
  return new Date(brt.getTime() + 3 * 60 * 60 * 1000);
}

export async function listPendenciasImpl(f: PendenciasFiltro = {}): Promise<PendenciasResultado> {
  const agora = Date.now();

  const { data: alunos } = await supabaseAdmin
    .from("alunos")
    .select("id, nome, whatsapp, modalidade, plano, status, data_d0, data_expiracao")
    .eq("status", "ativo")
    .not("data_d0", "is", null);

  const lista = (alunos ?? []).filter(
    (a: any) => !a.data_expiracao || new Date(a.data_expiracao).getTime() > agora,
  );
  const ids = lista.map((a: any) => a.id as string);
  if (ids.length === 0) {
    return {
      itens: [],
      indicadores: { total: 0, mensais: 0, quinzenais: 0, enviosManuaisHoje: 0, porUnidade: [] },
      responsaveis: [],
    };
  }

  const tiposJob = Object.values(JOB_POR_TIPO);

  const [{ data: jobs }, { data: logs }, { data: acoes }] = await Promise.all([
    supabaseAdmin
      .from("jobs_disparos")
      .select("id, aluno_id, tipo, agendado_para, executado, erro")
      .in("aluno_id", ids)
      .in("tipo", tiposJob as any)
      .eq("executado", false),
    supabaseAdmin
      .from("mensagens_log")
      .select("aluno_id, tipo_job, status_envio, enviado_em, erro_detalhe")
      .in("aluno_id", ids)
      .in("tipo_job", tiposJob)
      .order("enviado_em", { ascending: false })
      .limit(4000),
    supabaseAdmin
      .from("pendencias_comunicacao_acoes")
      .select("aluno_id, tipo_mensagem, data_prevista, acao, usuario_id, usuario_nome, observacao, criado_em")
      .in("aluno_id", ids)
      .order("criado_em", { ascending: false })
      .limit(4000),
  ]);

  // Último envio bem-sucedido e último erro por aluno+tipo
  const ultimoOk = new Map<string, number>();
  const ultimoErro = new Map<string, string>();
  for (const m of (logs ?? []) as any[]) {
    const tipo = TIPO_POR_JOB[m.tipo_job];
    if (!tipo || !m.aluno_id) continue;
    const k = `${m.aluno_id}|${tipo}`;
    const ts = m.enviado_em ? new Date(m.enviado_em).getTime() : 0;
    const ok = m.status_envio === "enviado" || m.status_envio === "enviado_manual";
    if (ok) {
      if (!ultimoOk.has(k) || ts > (ultimoOk.get(k) ?? 0)) ultimoOk.set(k, ts);
    } else if (m.status_envio === "erro" && m.erro_detalhe && !ultimoErro.has(k)) {
      ultimoErro.set(k, String(m.erro_detalhe));
    }
  }

  const jobPendente = new Map<string, { id: string; agendado_para: string; erro: string | null }>();
  for (const j of (jobs ?? []) as any[]) {
    const tipo = TIPO_POR_JOB[j.tipo];
    if (!tipo || !j.aluno_id) continue;
    const k = `${j.aluno_id}|${tipo}`;
    const atual = jobPendente.get(k);
    if (!atual || new Date(j.agendado_para).getTime() < new Date(atual.agendado_para).getTime()) {
      jobPendente.set(k, { id: j.id, agendado_para: j.agendado_para, erro: j.erro ?? null });
    }
  }

  const acaoMap = new Map<string, any>();
  for (const a of (acoes ?? []) as any[]) {
    const k = `${a.aluno_id}|${a.tipo_mensagem}`;
    if (!acaoMap.has(k)) acaoMap.set(k, a);
  }

  const itens: PendenciaItem[] = [];

  for (const a of lista as any[]) {
    const d0 = a.data_d0 ? new Date(a.data_d0).getTime() : null;
    if (!d0) continue;

    for (const tipo of Object.keys(CICLO_DIAS) as TipoPendencia[]) {
      const k = `${a.id}|${tipo}`;
      const base = ultimoOk.get(k) ?? d0;
      const job = jobPendente.get(k);

      let dataPrevista: number;
      if (job) {
        dataPrevista = new Date(job.agendado_para).getTime();
        if (dataPrevista > agora) continue; // ainda no prazo
      } else {
        dataPrevista = base + CICLO_DIAS[tipo] * DIA_MS;
        if (dataPrevista > agora) continue; // ciclo em dia
      }

      // Envio automático posterior ao vencimento resolve a pendência.
      const ok = ultimoOk.get(k);
      if (ok && ok >= dataPrevista) continue;

      const acao = acaoMap.get(k);
      let statusAtendimento: StatusAtendimento = "pendente";
      if (acao && new Date(acao.criado_em).getTime() >= dataPrevista) {
        statusAtendimento = acao.acao === "resolvido" ? "resolvido" : "enviado_manual";
      }

      itens.push({
        key: k,
        aluno_id: a.id,
        aluno_nome: a.nome ?? "—",
        whatsapp: a.whatsapp ?? "",
        unidade: a.modalidade ?? null,
        plano: a.plano ?? null,
        status_plano: a.status,
        tipo,
        data_prevista: new Date(dataPrevista).toISOString(),
        dias_atraso: diasEntre(agora, dataPrevista),
        motivo_erro: job?.erro ?? ultimoErro.get(k) ?? null,
        job_id: job?.id ?? null,
        status_atendimento: statusAtendimento,
        responsavel_nome: statusAtendimento === "pendente" ? null : (acao?.usuario_nome ?? null),
        responsavel_id: statusAtendimento === "pendente" ? null : (acao?.usuario_id ?? null),
        acao_em: statusAtendimento === "pendente" ? null : (acao?.criado_em ?? null),
        observacao: statusAtendimento === "pendente" ? null : (acao?.observacao ?? null),
      });
    }
  }

  // Filtros
  const deTs = f.de ? new Date(f.de).getTime() : null;
  const ateTs = f.ate ? new Date(f.ate).getTime() + DIA_MS : null;
  const filtrados = itens.filter((i) => {
    if (f.unidade && i.unidade !== f.unidade) return false;
    if (f.tipo && i.tipo !== f.tipo) return false;
    if (f.status && i.status_atendimento !== f.status) return false;
    if (f.responsavel && i.responsavel_id !== f.responsavel) return false;
    const ts = new Date(i.data_prevista).getTime();
    if (deTs && ts < deTs) return false;
    if (ateTs && ts >= ateTs) return false;
    return true;
  });

  filtrados.sort((a, b) => b.dias_atraso - a.dias_atraso || a.aluno_nome.localeCompare(b.aluno_nome, "pt-BR"));

  const inicioHoje = inicioHojeBRT().getTime();
  const enviosManuaisHoje = ((acoes ?? []) as any[]).filter(
    (a) => new Date(a.criado_em).getTime() >= inicioHoje,
  ).length;

  const porUnidadeMap = new Map<string, number>();
  filtrados.forEach((i) => {
    const u = i.unidade ?? "sem_unidade";
    porUnidadeMap.set(u, (porUnidadeMap.get(u) ?? 0) + 1);
  });

  const respMap = new Map<string, string>();
  ((acoes ?? []) as any[]).forEach((a) => {
    if (a.usuario_id) respMap.set(a.usuario_id, a.usuario_nome ?? "—");
  });

  return {
    itens: filtrados,
    indicadores: {
      total: filtrados.length,
      mensais: filtrados.filter((i) => i.tipo === "feedback_mensal").length,
      quinzenais: filtrados.filter((i) => i.tipo === "feedback_quinzenal").length,
      enviosManuaisHoje,
      porUnidade: Array.from(porUnidadeMap.entries())
        .map(([unidade, total]) => ({ unidade, total }))
        .sort((a, b) => b.total - a.total),
    },
    responsaveis: Array.from(respMap.entries()).map(([id, nome]) => ({ id, nome })),
  };
}

export async function registrarEnvioManualImpl(input: {
  alunoId: string;
  tipo: TipoPendencia;
  dataPrevista: string | null;
  observacao: string | null;
  jobId: string | null;
  acao: "enviado_manual" | "resolvido";
  usuarioId: string | null;
}): Promise<{ ok: boolean; error: string | null }> {
  let nome: string | null = null;
  if (input.usuarioId) {
    const { data: u } = await supabaseAdmin
      .from("usuarios_crm")
      .select("nome, email")
      .eq("id", input.usuarioId)
      .maybeSingle();
    nome = (u as any)?.nome ?? (u as any)?.email ?? null;
  }

  const { error } = await supabaseAdmin.from("pendencias_comunicacao_acoes").insert({
    aluno_id: input.alunoId,
    tipo_mensagem: input.tipo,
    data_prevista: input.dataPrevista,
    acao: input.acao,
    usuario_id: input.usuarioId,
    usuario_nome: nome,
    observacao: input.observacao,
    job_id: input.jobId,
  } as any);
  if (error) return { ok: false, error: error.message };

  // Fecha o job pendente para o motor não reenviar o mesmo ciclo.
  if (input.jobId) {
    await supabaseAdmin
      .from("jobs_disparos")
      .update({
        executado: true,
        executado_em: new Date().toISOString(),
        erro: "envio_manual_whatsapp",
      })
      .eq("id", input.jobId);
  }

  // Registra no histórico de mensagens para o ciclo seguir contando.
  const { data: aluno } = await supabaseAdmin
    .from("alunos")
    .select("whatsapp")
    .eq("id", input.alunoId)
    .maybeSingle();
  await supabaseAdmin.from("mensagens_log").insert({
    aluno_id: input.alunoId,
    tipo_job: JOB_POR_TIPO[input.tipo],
    mensagem_enviada: input.observacao ?? "(enviado manualmente via WhatsApp)",
    whatsapp_destino: (aluno as any)?.whatsapp ?? null,
    status_envio: "enviado_manual",
  } as any);

  return { ok: true, error: null };
}

export async function listHistoricoAcoesImpl(limite = 100) {
  const { data } = await supabaseAdmin
    .from("pendencias_comunicacao_acoes")
    .select("id, aluno_id, tipo_mensagem, data_prevista, acao, usuario_nome, observacao, criado_em")
    .order("criado_em", { ascending: false })
    .limit(limite);
  const ids = Array.from(new Set(((data ?? []) as any[]).map((a) => a.aluno_id)));
  const nomes: Record<string, string> = {};
  if (ids.length) {
    const { data: alunos } = await supabaseAdmin.from("alunos").select("id, nome").in("id", ids);
    ((alunos ?? []) as any[]).forEach((a) => { nomes[a.id] = a.nome ?? "—"; });
  }
  return {
    itens: ((data ?? []) as any[]).map((a) => ({ ...a, aluno_nome: nomes[a.aluno_id] ?? "—" })),
  };
}

export async function agendarCiclosAlunosAtivosImpl() {
  const { data, error } = await (supabaseAdmin as any).rpc("agendar_ciclos_alunos_ativos");
  if (error) return { ok: false, error: error.message };
  return { ok: true, ...(data ?? {}) };
}
