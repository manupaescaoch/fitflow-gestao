import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { enviarTextoZapiDireto } from "./zapi-send.server";

/** Métricas do topo do Motor de Automações. */
export const getMotorStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const agora = new Date().toISOString();

    const [{ count: alunosAtivos }, { count: programadas }, { count: erros }] = await Promise.all([
      supabaseAdmin.from("alunos").select("*", { count: "exact", head: true }).eq("status", "ativo"),
      supabaseAdmin.from("jobs_disparos").select("*", { count: "exact", head: true }).eq("executado", false).is("erro", null),
      supabaseAdmin.from("jobs_disparos").select("*", { count: "exact", head: true }).eq("executado", false).not("erro", "is", null),
    ]);

    const { data: proximo } = await supabaseAdmin
      .from("jobs_disparos")
      .select("agendado_para, tipo")
      .eq("executado", false)
      .gte("agendado_para", agora)
      .order("agendado_para", { ascending: true })
      .limit(1)
      .maybeSingle();

    const { data: ultima } = await supabaseAdmin
      .from("jobs_disparos")
      .select("executado_em, tipo")
      .eq("executado", true)
      .order("executado_em", { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      alunosAtivos: alunosAtivos ?? 0,
      mensagensProgramadas: programadas ?? 0,
      errosPendentes: erros ?? 0,
      proximoDisparo: proximo?.agendado_para ?? null,
      proximoTipo: proximo?.tipo ?? null,
      ultimaExecucao: ultima?.executado_em ?? null,
    };
  });

/** Envio de teste de uma mensagem fixa para um número informado. */
export const testarEnvioMensagem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { telefone: string; mensagem: string }) => {
    const telefone = String(data?.telefone ?? "").replace(/\D/g, "");
    const mensagem = String(data?.mensagem ?? "").trim();
    if (telefone.length < 10) throw new Error("Informe um WhatsApp válido com DDD");
    if (!mensagem) throw new Error("Mensagem vazia");
    return { telefone, mensagem: mensagem.slice(0, 4000) };
  })
  .handler(async ({ data }) => {
    const r = await enviarTextoZapiDireto({
      phone: data.telefone,
      mensagem: data.mensagem,
      tipoJob: "teste_motor",
    });
    return { ok: r.ok, error: r.error };
  });
