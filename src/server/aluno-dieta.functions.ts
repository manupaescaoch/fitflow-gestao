import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireAlunoAuth } from "./aluno-middleware";

export type AlunoDietaItem = {
  id: string;
  nome: string;
  quantidade: number;
  unidade: string;
  kcal: number;
  ptn: number;
  cho: number;
  lip: number;
  substitutos: AlunoDietaItem[];
};

export type AlunoDietaRefeicao = {
  id: string;
  nome: string;
  horario: string | null;
  observacoes: string | null;
  ordem: number;
  itens: AlunoDietaItem[];
  totais: { kcal: number; ptn: number; cho: number; lip: number };
};

export type AlunoDietaPlano = {
  id: string;
  nome: string;
  status: string;
  meta_kcal: number | null;
  ptn_g_kg: number | null;
  cho_g_kg: number | null;
  lip_g_kg: number | null;
  peso_referencia: number | null;
  observacoes: string | null;
  descricao: string | null;
  atualizado_em: string;
  refeicoes: AlunoDietaRefeicao[];
  totais: { kcal: number; ptn: number; cho: number; lip: number };
  totais_descricao: { kcal: number; ptn: number; cho: number; lip: number } | null;
};

export const getDietaAluno = createServerFn({ method: "POST" })
  .middleware([requireAlunoAuth])
  .handler(async ({ context }): Promise<{ plano: AlunoDietaPlano | null }> => {
    const aluno_id = context.alunoId;
    const sb = supabaseAdmin as any;

    const { data: plano } = await sb
      .from("dieta_planos")
      .select(
        "id, nome, status, meta_kcal, ptn_g_kg, cho_g_kg, lip_g_kg, peso_referencia, observacoes, descricao, atualizado_em",
      )
      .eq("aluno_id", aluno_id)
      .eq("status", "ativo")
      .order("atualizado_em", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!plano) return { plano: null };

    const { data: refeicoes } = await sb
      .from("dieta_refeicoes")
      .select("id, nome, horario, observacoes, ordem")
      .eq("plano_id", plano.id)
      .order("ordem", { ascending: true });

    const refIds = (refeicoes ?? []).map((r: any) => r.id);
    let itens: any[] = [];
    let subs: any[] = [];
    if (refIds.length) {
      const [{ data: itensData }, { data: subsData }] = await Promise.all([
        sb
          .from("dieta_itens")
          .select(
            "id, refeicao_id, alimento_id, nome_custom, quantidade, unidade, kcal, ptn, cho, lip, ordem, alimentos(nome)",
          )
          .in("refeicao_id", refIds)
          .order("ordem", { ascending: true }),
        sb
          .from("dieta_item_substitutos")
          .select(
            "id, item_id, alimento_id, nome_custom, quantidade, unidade, kcal, ptn, cho, lip, ordem, alimentos(nome)",
          )
          .order("ordem", { ascending: true }),
      ]);
      itens = itensData ?? [];
      const itemIds = new Set(itens.map((i) => i.id));
      subs = (subsData ?? []).filter((s: any) => itemIds.has(s.item_id));
    }

    const subsByItem = new Map<string, AlunoDietaItem[]>();
    for (const s of subs) {
      const list = subsByItem.get(s.item_id) ?? [];
      list.push({
        id: s.id,
        nome: s.alimentos?.nome ?? s.nome_custom ?? "Item",
        quantidade: Number(s.quantidade ?? 0),
        unidade: s.unidade ?? "g",
        kcal: Number(s.kcal ?? 0),
        ptn: Number(s.ptn ?? 0),
        cho: Number(s.cho ?? 0),
        lip: Number(s.lip ?? 0),
        substitutos: [],
      });
      subsByItem.set(s.item_id, list);
    }

    const refeicoesOut: AlunoDietaRefeicao[] = (refeicoes ?? []).map((r: any) => {
      const its = itens
        .filter((i) => i.refeicao_id === r.id)
        .map<AlunoDietaItem>((i) => ({
          id: i.id,
          nome: i.alimentos?.nome ?? i.nome_custom ?? "Item",
          quantidade: Number(i.quantidade ?? 0),
          unidade: i.unidade ?? "g",
          kcal: Number(i.kcal ?? 0),
          ptn: Number(i.ptn ?? 0),
          cho: Number(i.cho ?? 0),
          lip: Number(i.lip ?? 0),
          substitutos: subsByItem.get(i.id) ?? [],
        }));
      const totais = its.reduce(
        (acc, x) => ({
          kcal: acc.kcal + x.kcal,
          ptn: acc.ptn + x.ptn,
          cho: acc.cho + x.cho,
          lip: acc.lip + x.lip,
        }),
        { kcal: 0, ptn: 0, cho: 0, lip: 0 },
      );
      return {
        id: r.id,
        nome: r.nome,
        horario: r.horario,
        observacoes: r.observacoes,
        ordem: r.ordem ?? 0,
        itens: its,
        totais,
      };
    });

    const totais = refeicoesOut.reduce(
      (acc, r) => ({
        kcal: acc.kcal + r.totais.kcal,
        ptn: acc.ptn + r.totais.ptn,
        cho: acc.cho + r.totais.cho,
        lip: acc.lip + r.totais.lip,
      }),
      { kcal: 0, ptn: 0, cho: 0, lip: 0 },
    );

    // Tenta extrair macros da descricao do plano (formato livre)
    // Ex.: "1.750 kcal | 145g P / 203g C / 40g G"
    const parseDescricaoMacros = (
      desc: string | null,
    ): { kcal: number; ptn: number; cho: number; lip: number } | null => {
      if (!desc) return null;
      const norm = desc.replace(/\u00a0/g, " ");
      const num = (s: string) =>
        Number(s.replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
      const kcalM = norm.match(/([\d.,]+)\s*kcal/i);
      const ptnM = norm.match(/([\d.,]+)\s*g\s*(?:de\s+)?P(?:TN|rote[ií]nas?)?\b/i);
      const choM = norm.match(/([\d.,]+)\s*g\s*(?:de\s+)?C(?:HO|arbo\w*)?\b/i);
      const lipM = norm.match(/([\d.,]+)\s*g\s*(?:de\s+)?(?:G|L(?:IP|ip[ií]d\w*|ipid\w*)|Gord\w*)\b/i);
      if (!kcalM && !ptnM && !choM && !lipM) return null;
      return {
        kcal: kcalM ? num(kcalM[1]) : 0,
        ptn: ptnM ? num(ptnM[1]) : 0,
        cho: choM ? num(choM[1]) : 0,
        lip: lipM ? num(lipM[1]) : 0,
      };
    };
    const totaisDesc = parseDescricaoMacros(plano.descricao);

    return {
      plano: {
        id: plano.id,
        nome: plano.nome,
        status: plano.status,
        meta_kcal: plano.meta_kcal,
        ptn_g_kg: plano.ptn_g_kg,
        cho_g_kg: plano.cho_g_kg,
        lip_g_kg: plano.lip_g_kg,
        peso_referencia: plano.peso_referencia,
        observacoes: plano.observacoes,
        descricao: plano.descricao ?? null,
        atualizado_em: plano.atualizado_em,
        refeicoes: refeicoesOut,
        totais,
        totais_descricao: totaisDesc,
      },
    };
  });