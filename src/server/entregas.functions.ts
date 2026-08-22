import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const DesfazerSchema = z.object({
  entregaId: z.string().uuid(),
  campo: z.enum(["dieta_entregue", "treino_entregue", "d0_confirmado"]),
  anteriorEm: z.string().nullable().optional(),
  anteriorPor: z.string().nullable().optional(),
});

export const registrarDesfazerEntrega = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DesfazerSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Quem está executando: nome do CRM ou e-mail
    const { data: u } = await supabase
      .from("usuarios_crm")
      .select("nome, email")
      .eq("id", userId)
      .maybeSingle();
    const por = u?.nome ?? u?.email ?? "usuario";

    // Busca entrega para registrar aluno_nome e data_referencia
    const { data: ent } = await supabase
      .from("entregas_dia")
      .select("aluno_id, data_referencia, aluno:alunos(nome)")
      .eq("id", data.entregaId)
      .maybeSingle();

    const alunoNome = (ent as { aluno?: { nome?: string } | null } | null)?.aluno?.nome ?? null;

    const tipoEvento =
      data.campo === "dieta_entregue" ? "desfazer_dieta"
      : data.campo === "treino_entregue" ? "desfazer_treino"
      : "desfazer_d0";

    // Insere via admin (RLS permite só service_role nessa tabela)
    const { error } = await supabaseAdmin.from("entregas_dia_log").insert({
      aluno_id: ent?.aluno_id ?? null,
      aluno_nome: alunoNome,
      origem: "app_visao_geral",
      tipo_evento: tipoEvento,
      data_referencia: ent?.data_referencia ?? null,
      data_base: new Date().toISOString().slice(0, 10),
      resultado: "desfeito",
      detalhes: {
        por,
        entrega_id: data.entregaId,
        campo: data.campo,
        anterior_em: data.anteriorEm ?? null,
        anterior_por: data.anteriorPor ?? null,
      },
    });

    if (error) throw new Error(error.message);
    return { ok: true };
  });

const ListarHistoricoSchema = z.object({
  alunoId: z.string().uuid(),
});

export type EntregaHistorico = {
  id: string;
  data_referencia: string;
  dieta_entregue: boolean;
  dieta_entregue_em: string | null;
  dieta_entregue_por: string | null;
  treino_entregue: boolean;
  treino_entregue_em: string | null;
  treino_entregue_por: string | null;
  d0_confirmado: boolean;
  d0_confirmado_em: string | null;
  d0_confirmado_por: string | null;
};

export const listarHistoricoEntregasAluno = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ListarHistoricoSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("entregas_dia")
      .select("id, data_referencia, dieta_entregue, dieta_entregue_em, dieta_entregue_por, treino_entregue, treino_entregue_em, treino_entregue_por, d0_confirmado, d0_confirmado_em, d0_confirmado_por")
      .eq("aluno_id", data.alunoId)
      .order("data_referencia", { ascending: false });
    if (error) throw new Error(error.message);

    const { data: logs, error: errL } = await supabase
      .from("entregas_dia_log")
      .select("id, criado_em, origem, tipo_evento, resultado, data_referencia, detalhes")
      .eq("aluno_id", data.alunoId)
      .order("criado_em", { ascending: false })
      .limit(50);
    if (errL) throw new Error(errL.message);

    return {
      entregas: (rows ?? []) as EntregaHistorico[],
      logs: logs ?? [],
    };
  });

const ListarConfirmacoesSchema = z.object({
  from: z.string(),
  to: z.string(),
  search: z.string().optional(),
  porUsuario: z.string().optional(),
});

export type ConfirmacaoRow = {
  entrega_id: string;
  data_referencia: string;
  aluno_id: string;
  aluno_nome: string;
  modalidade: string | null;
  tipo: "dieta" | "treino" | "d0";
  por: string | null;
  em: string;
};

export const listarConfirmacoes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ListarConfirmacoesSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("entregas_dia")
      .select("id, data_referencia, aluno_id, dieta_entregue, dieta_entregue_em, dieta_entregue_por, treino_entregue, treino_entregue_em, treino_entregue_por, d0_confirmado, d0_confirmado_em, d0_confirmado_por, aluno:alunos(nome, modalidade)")
      .or(`dieta_entregue_em.gte.${data.from},treino_entregue_em.gte.${data.from},d0_confirmado_em.gte.${data.from}`)
      .order("data_referencia", { ascending: false })
      .limit(2000);
    if (error) throw new Error(error.message);

    const fromMs = new Date(data.from).getTime();
    const toMs = new Date(data.to).getTime();
    const out: ConfirmacaoRow[] = [];
    type Row = {
      id: string; data_referencia: string; aluno_id: string;
      dieta_entregue: boolean; dieta_entregue_em: string | null; dieta_entregue_por: string | null;
      treino_entregue: boolean; treino_entregue_em: string | null; treino_entregue_por: string | null;
      d0_confirmado: boolean; d0_confirmado_em: string | null; d0_confirmado_por: string | null;
      aluno: { nome: string; modalidade: string | null } | null;
    };
    for (const r of (rows ?? []) as Row[]) {
      const nome = r.aluno?.nome ?? "—";
      const mod = r.aluno?.modalidade ?? null;
      const push = (tipo: "dieta" | "treino" | "d0", em: string | null, por: string | null) => {
        if (!em) return;
        const t = new Date(em).getTime();
        if (t < fromMs || t > toMs) return;
        if (data.search && !nome.toLowerCase().includes(data.search.toLowerCase())) return;
        if (data.porUsuario && data.porUsuario !== "__all__" && (por ?? "—") !== data.porUsuario) return;
        out.push({
          entrega_id: r.id, data_referencia: r.data_referencia,
          aluno_id: r.aluno_id, aluno_nome: nome, modalidade: mod,
          tipo, por, em,
        });
      };
      if (r.dieta_entregue) push("dieta", r.dieta_entregue_em, r.dieta_entregue_por);
      if (r.treino_entregue) push("treino", r.treino_entregue_em, r.treino_entregue_por);
      if (r.d0_confirmado) push("d0", r.d0_confirmado_em, r.d0_confirmado_por);
    }

    out.sort((a, b) => b.em.localeCompare(a.em));

    // Agregado por usuário
    const porUser = new Map<string, number>();
    for (const c of out) {
      const k = c.por ?? "—";
      porUser.set(k, (porUser.get(k) ?? 0) + 1);
    }
    const usuarios = Array.from(porUser.entries())
      .map(([nome, total]) => ({ nome, total }))
      .sort((a, b) => b.total - a.total);

    return { rows: out, total: out.length, usuarios };
  });