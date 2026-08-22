import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { enviarWhatsAppTeste } from "./zapi-send.server";
import { primeiroNome } from "@/lib/nome";

export type RenovacaoUrgente = {
  id: string;
  nome: string;
  modalidade: string | null;
  plano: string | null;
  status: string;
  whatsapp: string;
  data_expiracao: string;
  dias: number; // negativo = vencido há X dias; positivo = vence em X dias
  ultima_cobranca_em: string | null;
  ultima_cobranca_status: string | null;
};

export const listRenovacoesUrgentes = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async () => {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const limite = new Date(hoje.getTime() + 7 * 86400000);
  limite.setHours(23, 59, 59, 999);

  const { data: alunos } = await supabaseAdmin
    .from("alunos")
    .select("id, nome, modalidade, plano, status, whatsapp, data_expiracao")
    .not("data_expiracao", "is", null)
    .neq("status", "renovado")
    .neq("status", "cancelado")
    .neq("status", "aguardando_renovacao")
    .lte("data_expiracao", limite.toISOString())
    .order("data_expiracao", { ascending: true });

  const lista = (alunos ?? []) as Array<{
    id: string; nome: string; modalidade: string | null; plano: string | null;
    status: string; whatsapp: string; data_expiracao: string;
  }>;

  // Última cobrança por aluno
  const ids = lista.map((a) => a.id);
  const cobrancaMap = new Map<string, { enviado_em: string; status: string | null }>();
  if (ids.length > 0) {
    const { data: msgs } = await supabaseAdmin
      .from("mensagens_log")
      .select("aluno_id, enviado_em, status_envio")
      .in("aluno_id", ids)
      .eq("tipo_job", "cobranca_renovacao")
      .order("enviado_em", { ascending: false });
    (msgs ?? []).forEach((m: any) => {
      if (!cobrancaMap.has(m.aluno_id)) {
        cobrancaMap.set(m.aluno_id, { enviado_em: m.enviado_em, status: m.status_envio });
      }
    });
  }

  const itens: RenovacaoUrgente[] = lista.map((a) => {
    const exp = new Date(a.data_expiracao);
    const diffMs = exp.getTime() - hoje.getTime();
    const dias = Math.ceil(diffMs / 86400000);
    const cob = cobrancaMap.get(a.id) ?? null;
    return {
      id: a.id,
      nome: a.nome,
      modalidade: a.modalidade,
      plano: a.plano,
      status: a.status,
      whatsapp: a.whatsapp,
      data_expiracao: a.data_expiracao,
      dias,
      ultima_cobranca_em: cob?.enviado_em ?? null,
      ultima_cobranca_status: cob?.status ?? null,
    };
  });

  const vencidos = itens.filter((i) => i.dias < 0);
  const proximos = itens.filter((i) => i.dias >= 0 && i.dias <= 7);

  return { vencidos, proximos };
});

export const enviarCobrancaRenovacao = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: { alunoId: string }) => {
    if (!d?.alunoId) throw new Error("alunoId obrigatório");
    return d;
  })
  .handler(async ({ data }) => {
    const { data: aluno } = await supabaseAdmin
      .from("alunos")
      .select("id, nome, data_expiracao")
      .eq("id", data.alunoId)
      .maybeSingle();
    if (!aluno) return { ok: false, error: "Aluno não encontrado" };

    const { data: cfg } = await supabaseAdmin
      .from("financeiro_config")
      .select("mensagem_cobranca")
      .limit(1)
      .maybeSingle();
    const tpl = cfg?.mensagem_cobranca?.trim()
      || "Olá {{nome}}, seu plano vence em {{dias}} dias. Renove para não perder o acesso.";

    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    let dias = 0;
    if (aluno.data_expiracao) {
      const exp = new Date(aluno.data_expiracao);
      dias = Math.ceil((exp.getTime() - hoje.getTime()) / 86400000);
    }
    const diasTxt = dias < 0 ? `${Math.abs(dias)} dias atrás` : `${dias} ${dias === 1 ? "dia" : "dias"}`;
    const mensagem = tpl
      .replace(/\{\{\s*nome\s*\}\}/g, primeiroNome(aluno.nome))
      .replace(/\{\{\s*dias\s*\}\}/g, diasTxt);

    const r = await enviarWhatsAppTeste({
      alunoId: aluno.id,
      tipoJob: "cobranca_renovacao",
      mensagem,
    });
    return { ok: r.ok, error: r.error };
  });

export const marcarRenovacaoResolvida = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: { alunoId: string }) => {
    if (!d?.alunoId) throw new Error("alunoId obrigatório");
    return d;
  })
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("alunos")
      .update({ status: "aguardando_renovacao" })
      .eq("id", data.alunoId);
    return { ok: !error, error: error?.message ?? null };
  });