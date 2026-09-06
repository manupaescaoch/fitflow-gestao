import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const CHAVES_VARIANTES = [
  "MSG_CONFIRMACAO_ANAMNESE",
  "MSG_CONFIRMACAO_ENTREGA",
  "MSG_POS_ENTREGA_D1",
  "MSG_FOLLOWUP_D7",
  "MSG_LINK_QUINZENAL",
  "MSG_LEMBRETE_QUINZENAL",
  "MSG_FOLLOWUP_D21",
  "MSG_LINK_MENSAL",
  "MSG_LEMBRETE_MENSAL",
  "MSG_CONFIRMACAO_QUINZENAL",
  "MSG_POS_FEEDBACK_MENSAL",
  "MSG_RENOVACAO_ANTES",
  "MSG_RENOVACAO_DIA",
  "MSG_RENOVACAO_APOS",
] as const;
export type ChaveVariante = (typeof CHAVES_VARIANTES)[number];

export const listMensagensVariantes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("mensagens_variantes")
      .select("id, chave, texto, ativo, ordem, atualizado_em")
      .in("chave", CHAVES_VARIANTES as unknown as string[])
      .order("chave", { ascending: true })
      .order("ordem", { ascending: true });
    if (error) throw new Error(error.message);
    return { variantes: data ?? [] };
  });

/**
 * Substitui todas as variantes de uma chave (replace-all).
 * Lista vazia = remove todas as variantes (motor cai no fallback).
 */
export const saveMensagensVariantes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { chave: string; variantes: { texto: string; ativo: boolean }[] }) => {
    if (!CHAVES_VARIANTES.includes(data.chave as ChaveVariante)) {
      throw new Error("Chave inválida");
    }
    if (!Array.isArray(data.variantes)) throw new Error("variantes deve ser array");
    const lim = data.variantes.slice(0, 20).map((v, i) => ({
      texto: String(v.texto ?? "").slice(0, 4000).trim(),
      ativo: v.ativo !== false,
      ordem: i,
    })).filter((v) => v.texto.length > 0);
    return { chave: data.chave as ChaveVariante, variantes: lim };
  })
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    // Replace all: delete + insert no admin client (RLS exige admin para escrita).
    const del = await supabaseAdmin
      .from("mensagens_variantes")
      .delete()
      .eq("chave", data.chave);
    if (del.error) throw new Error(del.error.message);
    if (data.variantes.length === 0) return { ok: true, salvos: 0 };
    const rows = data.variantes.map((v) => ({
      chave: data.chave,
      texto: v.texto,
      ativo: v.ativo,
      ordem: v.ordem,
      atualizado_por: userId,
    }));
    const ins = await supabaseAdmin.from("mensagens_variantes").insert(rows);
    if (ins.error) throw new Error(ins.error.message);
    return { ok: true, salvos: rows.length };
  });