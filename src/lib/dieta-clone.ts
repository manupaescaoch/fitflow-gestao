import { supabase } from "@/integrations/supabase/client";

/**
 * Clona um plano alimentar completo (refeições, itens e substitutos) para
 * um novo destino: outro aluno (`alunoId`) ou biblioteca (template = true).
 */
export async function clonarPlano(opts: {
  origemPlanoId: string;
  destino:
    | { tipo: "aluno"; alunoId: string; nome?: string }
    | { tipo: "template"; nome: string };
  criadoPor?: string | null;
}): Promise<{ id: string }> {
  const { origemPlanoId, destino, criadoPor } = opts;

  // 1. Carregar plano de origem
  const { data: origem, error: errOrigem } = await supabase
    .from("dieta_planos")
    .select("*")
    .eq("id", origemPlanoId)
    .single();
  if (errOrigem || !origem) throw new Error(errOrigem?.message ?? "Plano de origem não encontrado");

  // 2. Inserir novo plano
  const novoPayload =
    destino.tipo === "template"
      ? {
          aluno_id: null,
          template: true,
          status: "rascunho",
          nome: destino.nome,
          dias_semana: origem.dias_semana,
          peso_referencia: origem.peso_referencia,
          meta_kcal: origem.meta_kcal,
          ptn_g_kg: origem.ptn_g_kg,
          cho_g_kg: origem.cho_g_kg,
          lip_g_kg: origem.lip_g_kg,
          observacoes: origem.observacoes,
          descricao: origem.descricao,
          criado_por: criadoPor ?? null,
        }
      : {
          aluno_id: destino.alunoId,
          template: false,
          status: "rascunho",
          nome: destino.nome ?? origem.nome,
          dias_semana: origem.dias_semana,
          peso_referencia: origem.peso_referencia,
          meta_kcal: origem.meta_kcal,
          ptn_g_kg: origem.ptn_g_kg,
          cho_g_kg: origem.cho_g_kg,
          lip_g_kg: origem.lip_g_kg,
          observacoes: origem.observacoes,
          descricao: origem.descricao,
          criado_por: criadoPor ?? null,
        };

  const { data: novo, error: errNovo } = await supabase
    .from("dieta_planos")
    .insert(novoPayload)
    .select("id")
    .single();
  if (errNovo || !novo) throw new Error(errNovo?.message ?? "Erro ao criar plano");

  // 3. Refeições
  const { data: refs } = await supabase
    .from("dieta_refeicoes")
    .select("*")
    .eq("plano_id", origemPlanoId)
    .order("ordem");
  const refList = refs ?? [];
  if (!refList.length) return { id: novo.id };

  // map oldRefId -> newRefId
  const refMap = new Map<string, string>();
  for (const r of refList) {
    const { data: novaRef, error } = await supabase
      .from("dieta_refeicoes")
      .insert({
        plano_id: novo.id,
        ordem: r.ordem,
        nome: r.nome,
        horario: r.horario,
        observacoes: r.observacoes,
      })
      .select("id")
      .single();
    if (error || !novaRef) throw new Error(error?.message ?? "Erro ao copiar refeição");
    refMap.set(r.id, novaRef.id);
  }

  // 4. Itens
  const { data: itens } = await supabase
    .from("dieta_itens")
    .select("*")
    .in("refeicao_id", Array.from(refMap.keys()))
    .order("ordem");
  const itemMap = new Map<string, string>();
  for (const it of itens ?? []) {
    const newRefId = refMap.get(it.refeicao_id);
    if (!newRefId) continue;
    const { data: novoItem, error } = await supabase
      .from("dieta_itens")
      .insert({
        refeicao_id: newRefId,
        ordem: it.ordem,
        alimento_id: it.alimento_id,
        nome_custom: it.nome_custom,
        quantidade: it.quantidade,
        unidade: it.unidade,
        kcal: it.kcal,
        ptn: it.ptn,
        cho: it.cho,
        lip: it.lip,
      })
      .select("id")
      .single();
    if (error || !novoItem) throw new Error(error?.message ?? "Erro ao copiar item");
    itemMap.set(it.id, novoItem.id);
  }

  // 5. Substitutos
  if (itemMap.size > 0) {
    const { data: subs } = await supabase
      .from("dieta_item_substitutos")
      .select("*")
      .in("item_id", Array.from(itemMap.keys()))
      .order("ordem");
    const payload = (subs ?? [])
      .map((s) => {
        const newItemId = itemMap.get(s.item_id);
        if (!newItemId) return null;
        return {
          item_id: newItemId,
          ordem: s.ordem,
          alimento_id: s.alimento_id,
          nome_custom: s.nome_custom,
          quantidade: s.quantidade,
          unidade: s.unidade,
          kcal: s.kcal,
          ptn: s.ptn,
          cho: s.cho,
          lip: s.lip,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    if (payload.length) {
      await supabase.from("dieta_item_substitutos").insert(payload);
    }
  }

  return { id: novo.id };
}