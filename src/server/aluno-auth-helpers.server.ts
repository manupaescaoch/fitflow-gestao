import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getAlunoSessionServer } from "./aluno-session.server";

export function digits(s: string) {
  return (s || "").replace(/\D/g, "");
}

/** Senha inicial = DDD + número (sem o código do país 55). */
export function senhaInicialFromWhatsapp(whatsapp: string) {
  let d = digits(whatsapp);
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  return d;
}

export async function setAlunoCookie(
  row: {
    id: string;
    nome: string;
    email: string | null;
    whatsapp: string | null;
    foto_url?: string | null;
  },
  deveTrocarSenha: boolean,
) {
  const session = await getAlunoSessionServer();
  await session.update({
    aluno_id: row.id,
    nome: row.nome,
    email: row.email ?? null,
    whatsapp: row.whatsapp ?? null,
    foto_url: row.foto_url ?? null,
    deve_trocar_senha: deveTrocarSenha,
    iat: Math.floor(Date.now() / 1000),
  });
}

export async function loadDashboard(alunoId: string) {
  // 1 round-trip via RPC consolidado (substitui 11 queries paralelas).
  const { data, error } = await (supabaseAdmin as any).rpc("get_aluno_dashboard", {
    _aluno_id: alunoId,
  });
  if (error) throw new Error(error.message);
  const d = (data ?? {}) as any;
  return {
    aluno: d.aluno ?? null,
    avaliacoes: d.avaliacoes ?? [],
    circunferencias: d.circunferencias ?? null,
    dieta: d.dieta ?? null,
    checkins: d.checkins ?? [],
    entregas: d.entregas ?? [],
    feedbacks: d.feedbacks ?? [],
    transacoes: d.transacoes ?? [],
    comunicacoes: d.comunicacoes ?? [],
    agua_ml_hoje: Number(d.agua_ml_hoje ?? 0),
    atividades_hoje: d.atividades_hoje ?? [],
    refeicoes_hoje: d.refeicoes_hoje ?? [],
  };
}