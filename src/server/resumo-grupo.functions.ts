import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

const MODAL_LABEL: Record<string, string> = {
  mpteam: "MPTEAM",
  mp_elite: "MP Elite",
  mp_presencial: "MP Presencial",
};

function hojeISO(): string {
  // Data local Brasília (UTC-3 simplificado via toLocaleDateString pt-BR)
  const d = new Date();
  // ISO yyyy-mm-dd em America/Sao_Paulo
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });
  return fmt.format(d);
}

function diasEntre(dateISO: string, hoje: string): number {
  const a = new Date(dateISO + "T00:00:00Z").getTime();
  const b = new Date(hoje + "T00:00:00Z").getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

async function montarResumo(): Promise<string> {
  const hoje = hojeISO();

  // Janela: do início do mês até hoje (cobre atrasadas)
  const inicio = hoje.slice(0, 8) + "01";

  const { data: entregas } = await supabaseAdmin
    .from("entregas_dia")
    .select("id, aluno_id, data_referencia, dieta_entregue, treino_entregue, d0_confirmado, aluno:alunos(nome, modalidade, plano)")
    .gte("data_referencia", inicio)
    .lte("data_referencia", hoje)
    .order("data_referencia", { ascending: true });

  type Row = {
    id: string; aluno_id: string; data_referencia: string;
    dieta_entregue: boolean; treino_entregue: boolean; d0_confirmado: boolean;
    aluno: { nome: string; modalidade: string | null; plano: string | null } | null;
  };

  const list = (entregas ?? []) as unknown as Row[];

  const pendentesHoje = list.filter((e) =>
    e.data_referencia === hoje && !(e.dieta_entregue && e.treino_entregue && e.d0_confirmado)
  );
  const concluidosHoje = list.filter((e) =>
    e.data_referencia === hoje && e.dieta_entregue && e.treino_entregue && e.d0_confirmado
  );
  const atrasadas = list.filter((e) =>
    e.data_referencia < hoje && !(e.dieta_entregue && e.treino_entregue && e.d0_confirmado)
  );

  const dataBR = new Date(hoje + "T12:00:00Z").toLocaleDateString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long", timeZone: "America/Sao_Paulo",
  });

  const linhas: string[] = [];
  linhas.push(`📋 *ATUALIZAÇÕES DO DIA*`);
  linhas.push(`${dataBR.charAt(0).toUpperCase() + dataBR.slice(1)}`);
  linhas.push("");
  linhas.push(`📊 *RESUMO*`);
  linhas.push(`• PENDENTES: *${pendentesHoje.length}*`);
  linhas.push(`• CONCLUÍDOS: *${concluidosHoje.length}*`);
  linhas.push(`• ATRASADAS: *${atrasadas.length}*`);
  linhas.push("");

  function formatItem(e: Row): string {
    const nome = (e.aluno?.nome ?? "Aluno").toLocaleUpperCase("pt-BR");
    const mod = e.aluno?.modalidade ? ` (${MODAL_LABEL[e.aluno.modalidade] ?? e.aluno.modalidade})` : "";
    const plano = e.aluno?.plano ? ` — ${e.aluno.plano}` : "";
    const faltam: string[] = [];
    if (!e.dieta_entregue) faltam.push("Dieta");
    if (!e.treino_entregue) faltam.push("Treino");
    if (!e.d0_confirmado) faltam.push("D0");
    const sufixo = faltam.length ? `\nFalta: ${faltam.join(", ")}` : "";
    return `• ${nome}${mod}${plano}${sufixo}`;
  }

  if (pendentesHoje.length) {
    linhas.push(`⏳ *PENDENTES HOJE*`);
    pendentesHoje.forEach((e, i) => {
      linhas.push(formatItem(e));
      if (i < pendentesHoje.length - 1) linhas.push("");
    });
    linhas.push("");
  }

  if (concluidosHoje.length) {
    linhas.push(`✅ *CONCLUÍDOS HOJE*`);
    concluidosHoje.forEach((e, i) => {
      const nome = (e.aluno?.nome ?? "Aluno").toLocaleUpperCase("pt-BR");
      const mod = e.aluno?.modalidade ? ` (${MODAL_LABEL[e.aluno.modalidade] ?? e.aluno.modalidade})` : "";
      const plano = e.aluno?.plano ? ` — ${e.aluno.plano}` : "";
      linhas.push(`• ${nome}${mod}${plano}`);
      if (i < concluidosHoje.length - 1) linhas.push("");
    });
    linhas.push("");
  }

  if (atrasadas.length) {
    linhas.push(`🚨 *ATRASADAS*`);
    atrasadas.forEach((e, i) => {
      const dias = diasEntre(e.data_referencia, hoje);
      const nome = (e.aluno?.nome ?? "Aluno").toLocaleUpperCase("pt-BR");
      const mod = e.aluno?.modalidade ? ` (${MODAL_LABEL[e.aluno.modalidade] ?? e.aluno.modalidade})` : "";
      const plano = e.aluno?.plano ? ` — ${e.aluno.plano}` : "";
      const faltam: string[] = [];
      if (!e.dieta_entregue) faltam.push("Dieta");
      if (!e.treino_entregue) faltam.push("Treino");
      if (!e.d0_confirmado) faltam.push("D0");
      linhas.push(`• ${nome}${mod}${plano} — ${dias} ${dias === 1 ? "dia" : "dias"} em atraso\nFalta: ${faltam.join(", ")}`);
      if (i < atrasadas.length - 1) linhas.push("");
    });
    linhas.push("");
  }

  if (!pendentesHoje.length && !atrasadas.length) {
    linhas.push(`🎉 Tudo em dia!`);
  }

  return linhas.join("\n").trim();
}

export const previewResumoDia = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async () => {
  const mensagem = await montarResumo();
  return { mensagem };
});

export const enviarResumoDiaGrupo = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ groupId: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const instance = process.env.ZAPI_INSTANCE_ID || process.env.ZAPI_INSTANCE;
    const token = process.env.ZAPI_TOKEN;
    const clientToken = process.env.ZAPI_CLIENT_TOKEN;
    if (!instance || !token || !clientToken) {
      return { ok: false as const, error: "Z-API não configurada" };
    }
    const mensagem = await montarResumo();
    const url = `https://api.z-api.io/instances/${instance}/token/${token}/send-text`;
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Client-Token": clientToken },
        body: JSON.stringify({ phone: data.groupId, message: mensagem }),
      });
      if (!r.ok) {
        const txt = await r.text();
        return { ok: false as const, error: `Z-API ${r.status}: ${txt.slice(0, 300)}` };
      }
      return { ok: true as const, mensagem };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "Falha Z-API" };
    }
  });