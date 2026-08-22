import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  gerarPlanoIA,
  completarRefeicaoIA, gerarAlternativaIA, substituirMantendoMacros,
} from "@/server/dieta.functions";
import { parseTextoDieta } from "@/lib/dieta-importar-texto";
import type { Aluno } from "@/lib/crm";
import {
  somaPlano, validarPlano, ZERO,
  serializeRefeicaoObs, parseRefeicaoObs, parsePlanoDescricao, serializePlanoDescricao, parseDietDescription,
  type DietaPlano, type DietaRefeicao, type DietaItem, type DietaItemComSubs, type ItemSub, type RefeicaoCompleta, type PlanoCompleto,
} from "@/lib/dieta";
import { useAuth } from "@/lib/auth";

import { RefeicaoCard } from "./RefeicaoCard";
import { RodapeFixo } from "./RodapeFixo";
import { EmptyState } from "./EmptyState";
import { StatusInteligente } from "./StatusInteligente";
import { WizardMpDiet, type WizardInput } from "./modals/WizardMpDiet";
import { ImportarTextoModal, type RefeicaoIA } from "./modals/ImportarTextoModal";
import { TemplateModal } from "./modals/TemplateModal";
import { NovaRefeicaoModal, type NovaRefeicaoPayload } from "./modals/NovaRefeicaoModal";
import type { NovoItemComSubs } from "./BuscaAlimento";
import { PlanoDescricaoCard } from "./PlanoDescricaoCard";
import { ResumoNutrientesCard } from "./ResumoNutrientesCard";
import { RefeicoesActionsBar } from "./RefeicoesActionsBar";
import { exportarPdfDieta } from "@/lib/dieta-pdf/gerar";
import { parseObservacoesField } from "@/lib/prescricao";
import { SeletorModoPlano } from "./SeletorModoPlano";

export type DietaHeaderActions = {
  onGerarIA?: () => void;
  onSalvarDieta?: () => void;
  salvando?: boolean;
  planoStatus?: string;
  hasPlano?: boolean;
};

export function DietaCockpit({
  alunoId, aluno, canEdit, onActionsChange,
}: {
  alunoId: string;
  aluno: Aluno;
  canEdit: boolean;
  onActionsChange?: (actions: DietaHeaderActions) => void;
}) {
  const { crmUser } = useAuth();
  const userTag = crmUser?.nome ?? crmUser?.email ?? "usuario";

  const fnGerar = useServerFn(gerarPlanoIA);
  const fnCompletar = useServerFn(completarRefeicaoIA);
  const fnAlternativa = useServerFn(gerarAlternativaIA);
  const fnSubstituir = useServerFn(substituirMantendoMacros);

  const [plano, setPlano] = useState<PlanoCompleto | null>(null);
  const [loading, setLoading] = useState(true);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [busyIA, setBusyIA] = useState(false);
  const [busyRefeicaoId, setBusyRefeicaoId] = useState<string | null>(null);
  const [openWizard, setOpenWizard] = useState(false);
  const [openImport, setOpenImport] = useState(false);
  const [openTemplate, setOpenTemplate] = useState(false);
  const [previewImport, setPreviewImport] = useState<RefeicaoIA[] | null>(null);
  const [openNovaRefeicao, setOpenNovaRefeicao] = useState(false);
  const [editRefId, setEditRefId] = useState<string | null>(null);

  useEffect(() => { void carregar(); }, [alunoId]);

  async function carregar() {
    setLoading(true);
    try {
      const { data: planos, error } = await supabase
        .from("dieta_planos")
        .select("*")
        .eq("aluno_id", alunoId)
        .eq("template", false)
        .neq("status", "arquivado")
        .order("atualizado_em", { ascending: false })
        .limit(1);
      if (error) throw error;
      const p = planos?.[0] as DietaPlano | undefined;
      if (!p) { setPlano(null); return; }
      const refeicoes = await loadRefeicoes(p.id);
      setPlano({ ...p, refeicoes });
    } catch (e: any) {
      console.error("[Dieta] erro ao carregar plano existente", e);
      toast.error(e?.message ?? "Erro ao carregar plano alimentar");
      setPlano(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadRefeicoes(planoId: string): Promise<RefeicaoCompleta[]> {
    const { data: refs, error: refsError } = await supabase
      .from("dieta_refeicoes").select("*")
      .eq("plano_id", planoId).order("ordem");
    if (refsError) throw refsError;
    if (!refs?.length) return [];
    const ids = refs.map((r) => r.id);
    const { data: itens, error: itensError } = await supabase
      .from("dieta_itens").select("*")
      .in("refeicao_id", ids).order("ordem");
    if (itensError) throw itensError;
    const itemIds = (itens ?? []).map((i) => i.id);
    let subsByItem = new Map<string, ItemSub[]>();
    if (itemIds.length) {
      const { data: subs, error: subsError } = await (supabase as any)
        .from("dieta_item_substitutos").select("*")
        .in("item_id", itemIds).order("ordem");
      if (subsError) throw subsError;
      ((subs ?? []) as ItemSub[]).forEach((s) => {
        const arr = subsByItem.get(s.item_id) ?? [];
        arr.push(s);
        subsByItem.set(s.item_id, arr);
      });
    }
    return (refs as DietaRefeicao[]).map((r) => ({
      ...r,
      itens: ((itens ?? []) as DietaItem[])
        .filter((i) => i.refeicao_id === r.id)
        .map<DietaItemComSubs>((i) => ({ ...i, substitutos: subsByItem.get(i.id) ?? [] })),
    }));
  }

  async function ensurePlano(modo: "calculado" | "texto_livre" = "calculado"): Promise<PlanoCompleto> {
    if (plano) return plano;
    const { data: existente, error: buscaError } = await supabase
      .from("dieta_planos")
      .select("*")
      .eq("aluno_id", alunoId)
      .eq("template", false)
      .neq("status", "arquivado")
      .order("atualizado_em", { ascending: false })
      .limit(1);
    if (buscaError) throw new Error(buscaError.message);
    const atual = existente?.[0] as DietaPlano | undefined;
    if (atual) {
      const refeicoes = await loadRefeicoes(atual.id);
      const completo: PlanoCompleto = { ...atual, refeicoes };
      setPlano(completo);
      return completo;
    }
    const descricao = modo === "texto_livre"
      ? serializePlanoDescricao("texto_livre", "", { kcal: 0, ptn: 0, cho: 0, lip: 0 })
      : null;
    const { data, error } = await supabase
      .from("dieta_planos")
      .insert({
        aluno_id: alunoId, nome: "Plano alimentar", criado_por: userTag,
        peso_referencia: aluno.valor_plano ? null : null,
        descricao,
        status: "ativo",
      })
      .select().single();
    if (error || !data) throw new Error(error?.message ?? "Falha");
    const novo: PlanoCompleto = { ...(data as DietaPlano), refeicoes: [] };
    setPlano(novo);
    return novo;
  }

  /** Cria o plano com o modo escolhido pelo usuário no seletor inicial. */
  async function criarPlanoComModo(modo: "calculado" | "texto_livre") {
    try {
      await ensurePlano(modo);
      toast.success(modo === "texto_livre" ? "Plano em modo texto livre criado" : "Plano criado");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao criar plano");
    }
  }

  /* ---------------- Persistência granular ---------------- */

  async function patchPlano(patch: Partial<DietaPlano>) {
    if (!plano) return;
    const next = { ...plano, ...patch };
    setPlano(next);
    setSalvando(true);
    try {
      const { error } = await supabase.from("dieta_planos").update(patch).eq("id", plano.id);
      if (error) throw error;
      setSavedAt(new Date());
    } catch (e: any) {
      console.error("[Dieta] erro ao atualizar plano existente", e, patch);
      toast.error(e?.message ?? "Erro ao salvar plano");
      void carregar();
    } finally {
      setSalvando(false);
    }
  }

  async function addRefeicao(parcial?: Partial<DietaRefeicao> & { modo?: "estruturado" | "texto_livre" }) {
    const p = await ensurePlano();
    const ordem = p.refeicoes.length;
    const planoLivre = parsePlanoDescricao(p.descricao).modo === "texto_livre";
    const usarTextoLivre = parcial?.modo === "texto_livre" || (parcial?.modo !== "estruturado" && planoLivre);
    const observacoes = parcial?.observacoes !== undefined
      ? parcial.observacoes
      : (usarTextoLivre ? serializeRefeicaoObs("texto_livre", "", "") : null);
    const { data, error } = await supabase
      .from("dieta_refeicoes")
      .insert({
        plano_id: p.id, ordem,
        nome: parcial?.nome ?? `Refeição ${ordem + 1}`,
        horario: parcial?.horario ?? null,
        observacoes,
      })
      .select().single();
    if (error || !data) { toast.error("Erro"); return null; }
    const nova: RefeicaoCompleta = { ...(data as DietaRefeicao), itens: [] };
    setPlano({ ...p, refeicoes: [...p.refeicoes, nova] });
    setSavedAt(new Date());
    return nova;
  }

  async function criarRefeicaoCompleta(payload: NovaRefeicaoPayload) {
    const nome = payload.nome?.trim();
    if (!nome) throw new Error("Informe a descrição da refeição");
    if (!payload.horario) throw new Error("Informe o horário da refeição");
    const p = await ensurePlano();
    const ordem = p.refeicoes.length;
    try {
      const { data: refRow, error } = await supabase
        .from("dieta_refeicoes")
        .insert({ plano_id: p.id, ordem, nome, horario: payload.horario, observacoes: payload.observacoes })
        .select().single();
      if (error || !refRow) throw new Error(error?.message ?? "Erro ao criar refeição");
      if (payload.itens && payload.itens.length > 0) {
        await inserirItensDaRefeicao(refRow.id, payload.itens);
      }
      await carregar();
      setSavedAt(new Date());
      setOpenNovaRefeicao(false);
      toast.success("Refeição adicionada");
    } catch (e: any) {
      console.error("[Dieta] erro ao criar refeição", e, payload);
      toast.error(e?.message ?? "Erro ao criar refeição");
      throw e;
    }
  }

  async function patchRefeicao(refId: string, patch: Partial<DietaRefeicao>) {
    if (!plano) return;
    setPlano({ ...plano, refeicoes: plano.refeicoes.map((r) => (r.id === refId ? { ...r, ...patch } : r)) });
    const { error } = await supabase.from("dieta_refeicoes").update(patch).eq("id", refId);
    if (error) { toast.error("Erro ao salvar refeição"); void carregar(); return; }
    setSavedAt(new Date());
  }

  async function deleteRefeicao(refId: string) {
    if (!plano) return;
    if (!confirm("Apagar esta refeição?")) return;
    setPlano({ ...plano, refeicoes: plano.refeicoes.filter((r) => r.id !== refId) });
    const { error } = await supabase.from("dieta_refeicoes").delete().eq("id", refId);
    if (error) { toast.error("Erro"); void carregar(); return; }
    setSavedAt(new Date());
  }

  async function duplicarRefeicao(refId: string) {
    if (!plano) return;
    const orig = plano.refeicoes.find((r) => r.id === refId);
    if (!orig) return;
    const ordem = plano.refeicoes.length;
    const novoNome = /\(cópia\)/i.test(orig.nome) ? orig.nome : `${orig.nome} (cópia)`;
    const { data: refRow, error } = await supabase
      .from("dieta_refeicoes")
      .insert({
        plano_id: plano.id,
        ordem,
        nome: novoNome,
        horario: orig.horario,
        observacoes: orig.observacoes,
      })
      .select().single();
    if (error || !refRow) { toast.error("Erro ao duplicar refeição"); return; }
    const novosItens: DietaItemComSubs[] = [];
    for (let i = 0; i < orig.itens.length; i++) {
      const it = orig.itens[i];
      const { data: itemRow, error: itemErr } = await supabase
        .from("dieta_itens")
        .insert({
          refeicao_id: refRow.id,
          ordem: i,
          alimento_id: it.alimento_id,
          nome_custom: it.nome_custom,
          quantidade: it.quantidade,
          unidade: it.unidade || "g",
          kcal: it.kcal, ptn: it.ptn, cho: it.cho, lip: it.lip,
        })
        .select().single();
      if (itemErr || !itemRow) { toast.error("Erro ao duplicar alimento"); continue; }
      let subsCriados: ItemSub[] = [];
      const subs = it.substitutos ?? [];
      if (subs.length) {
        const payload = subs.map((s, j) => ({
          item_id: (itemRow as DietaItem).id,
          ordem: j,
          alimento_id: s.alimento_id,
          nome_custom: s.nome_custom,
          quantidade: s.quantidade,
          unidade: s.unidade || "g",
          kcal: s.kcal, ptn: s.ptn, cho: s.cho, lip: s.lip,
        }));
        const { data: subsData, error: subErr } = await (supabase as any)
          .from("dieta_item_substitutos").insert(payload).select();
        if (subErr) toast.error("Erro ao duplicar substitutos");
        subsCriados = (subsData ?? []) as ItemSub[];
      }
      novosItens.push({ ...(itemRow as DietaItem), substitutos: subsCriados });
    }
    const nova: RefeicaoCompleta = { ...(refRow as DietaRefeicao), itens: novosItens };
    setPlano({ ...plano, refeicoes: [...plano.refeicoes, nova] });
    setSavedAt(new Date());
    toast.success("Refeição duplicada");
  }

  async function addItem(
    refId: string,
    item: Omit<DietaItem, "id" | "refeicao_id" | "criado_em" | "ordem">,
    substitutos: Omit<ItemSub, "id" | "item_id" | "criado_em" | "ordem">[] = [],
  ) {
    if (!plano) return;
    const ref = plano.refeicoes.find((r) => r.id === refId);
    if (!ref) return;
    const ordem = ref.itens.length;
    const { data, error } = await supabase
      .from("dieta_itens")
      .insert({ refeicao_id: refId, ordem, ...item })
      .select().single();
    if (error || !data) { toast.error("Erro ao adicionar item"); return; }
    let subsCriados: ItemSub[] = [];
    if (substitutos.length) {
      const payload = substitutos.map((s, j) => ({
        item_id: (data as DietaItem).id,
        ordem: j,
        alimento_id: s.alimento_id,
        nome_custom: s.nome_custom,
        quantidade: s.quantidade,
        unidade: s.unidade || "g",
        kcal: s.kcal, ptn: s.ptn, cho: s.cho, lip: s.lip,
      }));
      const { data: subsData, error: subErr } = await (supabase as any)
        .from("dieta_item_substitutos").insert(payload).select();
      if (subErr) toast.error("Erro ao salvar substitutos");
      subsCriados = (subsData ?? []) as ItemSub[];
    }
    const novoItem: DietaItemComSubs = { ...(data as DietaItem), substitutos: subsCriados };
    setPlano({
      ...plano,
      refeicoes: plano.refeicoes.map((r) => r.id === refId ? { ...r, itens: [...r.itens, novoItem] } : r),
    });
    setSavedAt(new Date());
  }

  async function patchItem(refId: string, itemId: string, patch: Partial<DietaItem>) {
    if (!plano) return;
    setPlano({
      ...plano,
      refeicoes: plano.refeicoes.map((r) => r.id === refId
        ? { ...r, itens: r.itens.map((i) => i.id === itemId ? { ...i, ...patch } : i) }
        : r),
    });
    const { error } = await supabase.from("dieta_itens").update(patch).eq("id", itemId);
    if (error) { toast.error("Erro"); void carregar(); return; }
    setSavedAt(new Date());
  }

  async function deleteItem(refId: string, itemId: string) {
    if (!plano) return;
    setPlano({
      ...plano,
      refeicoes: plano.refeicoes.map((r) => r.id === refId ? { ...r, itens: r.itens.filter((i) => i.id !== itemId) } : r),
    });
    const { error } = await supabase.from("dieta_itens").delete().eq("id", itemId);
    if (error) { toast.error("Erro"); void carregar(); return; }
    setSavedAt(new Date());
  }

  async function reorderItens(refId: string, novaOrdemIds: string[]) {
    if (!plano) return;
    const ref = plano.refeicoes.find((r) => r.id === refId);
    if (!ref) return;
    const byId = new Map(ref.itens.map((i) => [i.id, i] as const));
    const reordered = novaOrdemIds.map((id) => byId.get(id)).filter(Boolean) as typeof ref.itens;
    if (reordered.length !== ref.itens.length) return;
    // Atualização otimista
    setPlano({
      ...plano,
      refeicoes: plano.refeicoes.map((r) =>
        r.id === refId ? { ...r, itens: reordered.map((i, idx) => ({ ...i, ordem: idx })) } : r,
      ),
    });
    // Persiste em paralelo
    const updates = await Promise.all(
      reordered.map((it, idx) =>
        supabase.from("dieta_itens").update({ ordem: idx }).eq("id", it.id),
      ),
    );
    if (updates.some((u) => u.error)) {
      toast.error("Erro ao reordenar");
      void carregar();
      return;
    }
    setSavedAt(new Date());
  }

  async function moverRefeicao(refId: string, dir: "up" | "down") {
    if (!plano) return;
    const idx = plano.refeicoes.findIndex((r) => r.id === refId);
    if (idx === -1) return;
    const novoIdx = dir === "up" ? idx - 1 : idx + 1;
    if (novoIdx < 0 || novoIdx >= plano.refeicoes.length) return;
    const reordered = [...plano.refeicoes];
    const [moved] = reordered.splice(idx, 1);
    reordered.splice(novoIdx, 0, moved);
    // Atualização otimista
    setPlano({
      ...plano,
      refeicoes: reordered.map((r, i) => ({ ...r, ordem: i })),
    });
    const updates = await Promise.all(
      reordered.map((r, i) =>
        supabase.from("dieta_refeicoes").update({ ordem: i }).eq("id", r.id),
      ),
    );
    if (updates.some((u) => u.error)) {
      toast.error("Erro ao reordenar refeições");
      void carregar();
      return;
    }
    setSavedAt(new Date());
  }

  async function replaceItem(refId: string, itemId: string, novo: NovoItemComSubs) {
    if (!plano) return;
    // 1) Apaga substitutos antigos
    await (supabase as any).from("dieta_item_substitutos").delete().eq("item_id", itemId);
    // 2) Atualiza item principal
    const { error: errUp } = await supabase.from("dieta_itens").update({
      alimento_id: novo.alimento_id,
      nome_custom: novo.nome_custom,
      quantidade: novo.quantidade,
      unidade: novo.unidade || "g",
      kcal: novo.kcal, ptn: novo.ptn, cho: novo.cho, lip: novo.lip,
    }).eq("id", itemId);
    if (errUp) { toast.error("Erro ao substituir alimento"); void carregar(); return; }
    // 3) Insere novos substitutos
    if (novo.substitutos.length) {
      const payload = novo.substitutos.map((s, j) => ({
        item_id: itemId, ordem: j,
        alimento_id: s.alimento_id, nome_custom: s.nome_custom,
        quantidade: s.quantidade, unidade: s.unidade || "g",
        kcal: s.kcal, ptn: s.ptn, cho: s.cho, lip: s.lip,
      }));
      const { error: errSub } = await (supabase as any)
        .from("dieta_item_substitutos").insert(payload);
      if (errSub) toast.error("Erro ao salvar substitutos");
    }
    await carregar();
    setSavedAt(new Date());
    toast.success("Alimento atualizado");
  }

  async function editarRefeicaoCompleta(refId: string, payload: NovaRefeicaoPayload) {
    if (!plano) return;
    const nome = payload.nome?.trim();
    if (!nome) throw new Error("Informe a descrição da refeição");
    if (!payload.horario) throw new Error("Informe o horário da refeição");
    const refAtual = plano.refeicoes.find((r) => r.id === refId);
    if (!refAtual) throw new Error("Refeição não encontrada para atualização");

    try {
      const { data: updated, error: errUp } = await supabase
        .from("dieta_refeicoes")
        .update({ nome, horario: payload.horario, observacoes: payload.observacoes })
        .eq("id", refId)
        .select("id")
        .maybeSingle();
      if (errUp) throw errUp;
      if (!updated) throw new Error("Nenhuma refeição foi atualizada. Verifique permissão ou se o registro ainda existe.");

      const modoAtualizado = parseRefeicaoObs(payload.observacoes).modo;
      if (modoAtualizado === "texto_livre") {
        await substituirItensDaRefeicao(refId, []);
      } else if (payload.itens) {
        await substituirItensDaRefeicao(refId, payload.itens);
      }
      await carregar();
      setSavedAt(new Date());
      setEditRefId(null);
      toast.success("Refeição atualizada");
    } catch (e: any) {
      console.error("[Dieta] erro ao editar refeição existente", e, { refId, payload });
      toast.error(e?.message ?? "Erro ao salvar refeição");
      void carregar();
      throw e;
    }
  }

  async function substituirItensDaRefeicao(refId: string, itens: NovoItemComSubs[]) {
    const { error: delError } = await supabase.from("dieta_itens").delete().eq("refeicao_id", refId);
    if (delError) throw new Error(`Erro ao remover alimentos antigos: ${delError.message}`);
    await inserirItensDaRefeicao(refId, itens);
  }

  async function inserirItensDaRefeicao(refId: string, itens: NovoItemComSubs[]) {
    for (let i = 0; i < itens.length; i++) {
      const it = itens[i];
      const nomeCustom = it.nome_custom?.trim();
      if (!nomeCustom) throw new Error(`Alimento ${i + 1} sem nome`);
      const { data: itemRow, error: itemErr } = await supabase
        .from("dieta_itens")
        .insert({
          refeicao_id: refId,
          ordem: i,
          alimento_id: it.alimento_id,
          nome_custom: nomeCustom,
          quantidade: Number.isFinite(Number(it.quantidade)) ? Number(it.quantidade) : 0,
          unidade: it.unidade || "g",
          kcal: Number.isFinite(Number(it.kcal)) ? Number(it.kcal) : 0,
          ptn: Number.isFinite(Number(it.ptn)) ? Number(it.ptn) : 0,
          cho: Number.isFinite(Number(it.cho)) ? Number(it.cho) : 0,
          lip: Number.isFinite(Number(it.lip)) ? Number(it.lip) : 0,
        })
        .select().single();
      if (itemErr || !itemRow) throw new Error(itemErr?.message ?? `Erro ao salvar alimento ${i + 1}`);

      const subs = it.substitutos ?? [];
      if (subs.length > 0) {
        const subsPayload = subs.map((s, j) => ({
          item_id: itemRow.id,
          ordem: j,
          alimento_id: s.alimento_id,
          nome_custom: s.nome_custom?.trim() || "Alimento",
          quantidade: Number.isFinite(Number(s.quantidade)) ? Number(s.quantidade) : 0,
          unidade: s.unidade || "g",
          kcal: Number.isFinite(Number(s.kcal)) ? Number(s.kcal) : 0,
          ptn: Number.isFinite(Number(s.ptn)) ? Number(s.ptn) : 0,
          cho: Number.isFinite(Number(s.cho)) ? Number(s.cho) : 0,
          lip: Number.isFinite(Number(s.lip)) ? Number(s.lip) : 0,
        }));
        const { error: subErr } = await (supabase as any)
          .from("dieta_item_substitutos").insert(subsPayload);
        if (subErr) throw new Error(`Erro ao salvar substitutos: ${subErr.message}`);
      }
    }
  }

  async function aplicarRefeicoesIA(refeicoes: RefeicaoIA[], modo: "substituir" | "anexar" = "substituir") {
    const p = await ensurePlano();
    if (modo === "substituir" && p.refeicoes.length > 0) {
      await supabase.from("dieta_refeicoes").delete().eq("plano_id", p.id);
    }
    const baseOrdem = modo === "anexar" ? p.refeicoes.length : 0;
    for (let i = 0; i < refeicoes.length; i++) {
      const r = refeicoes[i];
      const { data: refRow, error } = await supabase
        .from("dieta_refeicoes")
        .insert({ plano_id: p.id, ordem: baseOrdem + i, nome: r.nome, horario: r.horario ?? null, observacoes: r.observacoes ?? null })
        .select().single();
      if (error || !refRow) continue;
      if (r.itens.length) {
        const payload = r.itens.map((it, j) => ({
          refeicao_id: refRow.id, ordem: j, alimento_id: null, nome_custom: it.nome,
          quantidade: it.quantidade, unidade: it.unidade || "g",
          kcal: it.kcal, ptn: it.ptn, cho: it.cho, lip: it.lip,
        }));
        const { data: insertedItens } = await supabase
          .from("dieta_itens")
          .insert(payload)
          .select();

        // Cria substitutos a partir das opções alternativas (Opção 2, 3, ...).
        // Cada opção é uma alternativa COMPLETA da refeição. Para preservar
        // essa equivalência, anexamos cada opção como substitutos do PRIMEIRO
        // item (item-âncora), formando: item1 OU [bloco opção2] OU [bloco opção3]…
        const opcoes = r.opcoes ?? [];
        if (insertedItens && insertedItens.length > 0 && opcoes.length > 0) {
          const ancoraId = insertedItens[0].id;
          const subPayload: any[] = [];
          let ordem = 0;
          for (const op of opcoes) {
            for (const it of op) {
              subPayload.push({
                item_id: ancoraId,
                ordem: ordem++,
                alimento_id: null,
                nome_custom: it.nome,
                quantidade: it.quantidade,
                unidade: it.unidade || "g",
                kcal: it.kcal, ptn: it.ptn, cho: it.cho, lip: it.lip,
              });
            }
          }
          if (subPayload.length) {
            await supabase.from("dieta_item_substitutos").insert(subPayload);
          }
        }
      }
    }
    await carregar();
    setSavedAt(new Date());
    toast.success("Plano aplicado");
  }

  /* ---------------- IA ---------------- */

  async function handleWizardSubmit(input: WizardInput) {
    setBusyIA(true);
    try {
      const res = await fnGerar({ data: { ...input, nomeAluno: aluno.nome } });
      if (res.error || !res.plano) { toast.error(res.error ?? "Erro IA"); return; }
      // grava metas no plano
      const p = await ensurePlano();
      await supabase.from("dieta_planos").update({
        peso_referencia: input.peso,
        meta_kcal: input.meta_kcal ?? null,
        ptn_g_kg: input.ptn_g_kg ?? null,
        cho_g_kg: input.cho_g_kg ?? null,
        lip_g_kg: input.lip_g_kg ?? null,
      }).eq("id", p.id);
      await aplicarRefeicoesIA(res.plano.refeicoes, "substituir");
      setOpenWizard(false);
    } finally { setBusyIA(false); }
  }

  function handleAnalisarTexto(texto: string) {
    const refeicoes = parseTextoDieta(texto);
    if (refeicoes.length === 0) {
      toast.error("Nenhuma refeição detectada no texto.");
      return;
    }
    setPreviewImport(refeicoes);
  }

  async function handleAplicarImport(refeicoes: RefeicaoIA[]) {
    await aplicarRefeicoesIA(refeicoes, "substituir");
    setOpenImport(false);
    setPreviewImport(null);
  }

  /** Aplica o texto cru como uma refeição por bloco, em modo "texto livre". */
  async function handleAplicarImportTextoLivre(texto: string) {
    const blocos = splitBlocosTexto(texto);
    if (!blocos.length) { toast.error("Nenhum bloco detectado"); return; }
    const p = await ensurePlano();
    if (p.refeicoes.length > 0) {
      await supabase.from("dieta_refeicoes").delete().eq("plano_id", p.id);
    }
    for (let i = 0; i < blocos.length; i++) {
      const b = blocos[i];
      await supabase.from("dieta_refeicoes").insert({
        plano_id: p.id, ordem: i,
        nome: b.nome, horario: b.horario,
        observacoes: serializeRefeicaoObs("texto_livre", b.conteudo, ""),
      });
    }
    await carregar();
    setSavedAt(new Date());
    setOpenImport(false);
    setPreviewImport(null);
    toast.success("Importado como texto livre");
  }

  async function completarRefeicao(ref: RefeicaoCompleta) {
    setBusyRefeicaoId(ref.id);
    try {
      const res = await fnCompletar({ data: {
        nomeRefeicao: ref.nome, horario: ref.horario ?? undefined,
        metaKcal: plano?.meta_kcal ? plano.meta_kcal / Math.max(1, plano.refeicoes.length) : undefined,
        itensAtuais: ref.itens.map((i) => ({ nome: i.nome_custom ?? "", quantidade: Number(i.quantidade), unidade: i.unidade, kcal: Number(i.kcal), ptn: Number(i.ptn), cho: Number(i.cho), lip: Number(i.lip) })),
      } });
      if (res.error || !res.refeicao) { toast.error(res.error ?? "Erro IA"); return; }
      // limpa itens existentes e insere novos
      await supabase.from("dieta_itens").delete().eq("refeicao_id", ref.id);
      const payload = res.refeicao.itens.map((it, j) => ({
        refeicao_id: ref.id, ordem: j, alimento_id: null, nome_custom: it.nome,
        quantidade: it.quantidade, unidade: it.unidade || "g",
        kcal: it.kcal, ptn: it.ptn, cho: it.cho, lip: it.lip,
      }));
      if (payload.length) await supabase.from("dieta_itens").insert(payload);
      await carregar();
      toast.success("Refeição completada");
    } finally { setBusyRefeicaoId(null); }
  }

  async function alternativaRefeicao(ref: RefeicaoCompleta) {
    setBusyRefeicaoId(ref.id);
    try {
      const res = await fnAlternativa({ data: { refeicao: refToIA(ref) } });
      if (res.error || !res.refeicao) { toast.error(res.error ?? "Erro IA"); return; }
      await replaceItensRefeicao(ref.id, res.refeicao.itens);
      toast.success("Alternativa aplicada");
    } finally { setBusyRefeicaoId(null); }
  }

  async function substituirRefeicao(ref: RefeicaoCompleta) {
    setBusyRefeicaoId(ref.id);
    try {
      const res = await fnSubstituir({ data: { refeicao: refToIA(ref) } });
      if (res.error || !res.refeicao) { toast.error(res.error ?? "Erro IA"); return; }
      await replaceItensRefeicao(ref.id, res.refeicao.itens);
      toast.success("Itens substituídos");
    } finally { setBusyRefeicaoId(null); }
  }

  async function replaceItensRefeicao(refId: string, itens: RefeicaoIA["itens"]) {
    await supabase.from("dieta_itens").delete().eq("refeicao_id", refId);
    const payload = itens.map((it, j) => ({
      refeicao_id: refId, ordem: j, alimento_id: null, nome_custom: it.nome,
      quantidade: it.quantidade, unidade: it.unidade || "g",
      kcal: it.kcal, ptn: it.ptn, cho: it.cho, lip: it.lip,
    }));
    if (payload.length) await supabase.from("dieta_itens").insert(payload);
    await carregar();
  }

  /* ---------------- Templates ---------------- */

  async function carregarTemplate(templateId: string) {
    const { data: t } = await supabase.from("dieta_planos").select("*").eq("id", templateId).single();
    if (!t) return;
    const refs = await loadRefeicoes(templateId);
    const ref_ia: RefeicaoIA[] = refs.map((r) => ({
      nome: r.nome, horario: r.horario, observacoes: r.observacoes,
      itens: r.itens.map((i) => ({ nome: i.nome_custom ?? "", quantidade: Number(i.quantidade), unidade: i.unidade, kcal: Number(i.kcal), ptn: Number(i.ptn), cho: Number(i.cho), lip: Number(i.lip) })),
    }));
    const p = await ensurePlano();
    await supabase.from("dieta_planos").update({
      meta_kcal: t.meta_kcal, peso_referencia: t.peso_referencia,
      ptn_g_kg: t.ptn_g_kg, cho_g_kg: t.cho_g_kg, lip_g_kg: t.lip_g_kg,
    }).eq("id", p.id);
    await aplicarRefeicoesIA(ref_ia, "substituir");
    toast.success(`Template "${t.nome}" carregado`);
  }

  async function salvarComoTemplate(nome: string) {
    if (!plano) throw new Error("Sem plano");
    const { data: tpl, error } = await supabase
      .from("dieta_planos")
      .insert({
        aluno_id: null, template: true, nome,
        meta_kcal: plano.meta_kcal, peso_referencia: plano.peso_referencia,
        ptn_g_kg: plano.ptn_g_kg, cho_g_kg: plano.cho_g_kg, lip_g_kg: plano.lip_g_kg,
        criado_por: userTag,
      })
      .select().single();
    if (error || !tpl) throw new Error(error?.message);
    for (let i = 0; i < plano.refeicoes.length; i++) {
      const r = plano.refeicoes[i];
      const { data: refRow } = await supabase
        .from("dieta_refeicoes")
        .insert({ plano_id: tpl.id, ordem: i, nome: r.nome, horario: r.horario, observacoes: r.observacoes })
        .select().single();
      if (refRow && r.itens.length) {
        await supabase.from("dieta_itens").insert(r.itens.map((it, j) => ({
          refeicao_id: refRow.id, ordem: j, alimento_id: it.alimento_id, nome_custom: it.nome_custom,
          quantidade: it.quantidade, unidade: it.unidade,
          kcal: it.kcal, ptn: it.ptn, cho: it.cho, lip: it.lip,
        })));
      }
    }
  }

  /* ---------------- Status / salvar ---------------- */

  async function salvarStatus(status: "rascunho" | "ativo") {
    if (!plano) return;
    await patchPlano({ status });
    toast.success(status === "ativo" ? "Dieta salva como ativa" : "Rascunho salvo");
  }

  /* ---------------- Render ---------------- */

  const total = plano ? somaPlano(plano) : ZERO;
  const sinais = useMemo(() => plano ? validarPlano(plano) : [], [plano]);
  const vazio = !plano || plano.refeicoes.length === 0;
  const alertasCount = plano ? plano.refeicoes.reduce((acc, r) => acc + r.itens.filter((i) => !i.alimento_id).length, 0) : 0;

  const planoParsed = useMemo(() => parsePlanoDescricao(plano?.descricao), [plano?.descricao]);
  const modoPlano = planoParsed.modo;
  const totaisManuais = planoParsed.totaisManuais;
  const macrosDaDescricao = useMemo(() => {
    const descricao = modoPlano === "texto_livre" ? planoParsed.descricao : (plano?.descricao ?? "");
    const parsed = parseDietDescription(descricao, plano?.peso_referencia ?? aluno.peso_kg ?? null);
    if (!parsed.calories && !parsed.protein.grams && !parsed.carbs.grams && !parsed.fats.grams) return null;
    return { kcal: parsed.calories, ptn: parsed.protein.grams, cho: parsed.carbs.grams, lip: parsed.fats.grams };
  }, [modoPlano, planoParsed.descricao, plano?.descricao, plano?.peso_referencia, aluno.peso_kg]);
  const totaisExibidos = macrosDaDescricao ?? totaisManuais;
  const totalItensZero = total.kcal + total.ptn + total.cho + total.lip === 0;
  const fonteResumo: "descricao" | "manual" | undefined =
    modoPlano === "texto_livre"
      ? (macrosDaDescricao ? "descricao" : "manual")
      : (totalItensZero && macrosDaDescricao ? "descricao" : undefined);

  function patchTotaisManuais(patch: Partial<typeof totaisManuais>) {
    if (!plano) return;
    const novos = { ...totaisManuais, ...patch };
    const novaDesc = serializePlanoDescricao("texto_livre", planoParsed.descricao, novos);
    void patchPlano({ descricao: novaDesc });
  }

  // Reporta os botões de ação para o cabeçalho do pai
  useEffect(() => {
    if (!onActionsChange) return;
    onActionsChange({
      onGerarIA: canEdit ? () => setOpenWizard(true) : undefined,
      onSalvarDieta: canEdit && plano ? () => salvarStatus("ativo") : undefined,
      salvando,
      planoStatus: plano?.status,
      hasPlano: !!plano,
    });
    return () => onActionsChange(undefined as unknown as DietaHeaderActions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit, !!plano, plano?.status, salvando]);

  if (loading) {
    return <div className="py-12 flex items-center justify-center text-muted-foreground text-sm"><Loader2 className="w-4 h-4 animate-spin mr-2" /> Carregando dieta…</div>;
  }

  return (
    <div className="space-y-5">
      {plano && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Coluna esquerda — plano + refeições */}
          <div className="lg:col-span-2 space-y-5">
            <div className="rounded-2xl bg-white border border-slate-200/70 shadow-sm p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-[15px] font-semibold tracking-tight text-slate-900">Dieta · Plano alimentar</h2>
                  <p className="text-[12px] text-slate-500 mt-0.5">Configure macros, dias e refeições</p>
                </div>
                <select
                  value={plano.status}
                  disabled={!canEdit}
                  onChange={(e) => patchPlano({ status: e.target.value })}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-[12px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                >
                  <option value="rascunho">Rascunho</option>
                  <option value="ativo">Ativo</option>
                  <option value="aprovado">Aprovado</option>
                </select>
              </div>
              <PlanoDescricaoCard plano={plano} canEdit={canEdit} onChange={(patch) => patchPlano(patch)} hideStatus />
            </div>

            {/* Refeições */}
            <div className="rounded-2xl bg-white border border-slate-200/70 shadow-sm overflow-visible">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-[15px] font-semibold tracking-tight text-slate-900">Refeições do dia</h2>
                  <p className="text-[12px] text-slate-500 mt-0.5">{plano.refeicoes.length} {plano.refeicoes.length === 1 ? "refeição" : "refeições"}</p>
                </div>
                {canEdit && (
                  <RefeicoesActionsBar
                    canEdit={canEdit}
                    modoPlano={modoPlano}
                    onAssistenteIA={modoPlano === "texto_livre" ? () => { setPreviewImport(null); setOpenImport(true); } : () => setOpenWizard(true)}
                    onImportar={() => { setPreviewImport(null); setOpenImport(true); }}
                    onAdicionarRefeicao={modoPlano === "texto_livre"
                      ? () => setOpenNovaRefeicao(true)
                      : () => setOpenNovaRefeicao(true)}
                    onTemplate={modoPlano === "texto_livre" ? () => { setPreviewImport(null); setOpenImport(true); } : () => setOpenTemplate(true)}
                    onExportarPdf={() => {
                      try {
                        exportarPdfDieta(plano!, aluno);
                        toast.success("PDF gerado");
                      } catch (e) {
                        toast.error("Falha ao gerar PDF");
                        console.error(e);
                      }
                    }}
                    onApagarPlano={async () => {
                      if (!confirm("Apagar todo o plano?")) return;
                      await supabase.from("dieta_planos").delete().eq("id", plano.id);
                      setPlano(null);
                      toast.success("Plano apagado");
                    }}
                  />
                )}
              </div>

              {vazio ? (
                <div className="p-6">
                  <EmptyState
                    canEdit={canEdit}
                    variant={modoPlano}
                    onGerarIA={() => setOpenWizard(true)}
                    onImportar={() => { setPreviewImport(null); setOpenImport(true); }}
                    onTemplate={() => setOpenTemplate(true)}
                    onManual={() => setOpenNovaRefeicao(true)}
                  />
                </div>
              ) : (
                <div>
                  {plano!.refeicoes.map((r, idx) => (
                    <RefeicaoCard
                      key={r.id}
                      refeicao={r}
                      canEdit={canEdit}
                      lockTextoLivre={modoPlano === "texto_livre"}
                      defaultOpen={idx === 0}
                      busyIA={busyRefeicaoId === r.id}
                      onUpdateRefeicao={(patch) => patchRefeicao(r.id, patch)}
                      onEditarCompleto={() => setEditRefId(r.id)}
                      onAddItem={(it) => addItem(r.id, it)}
                      onUpdateItem={(itemId, patch) => patchItem(r.id, itemId, patch)}
                      onReplaceItem={(itemId, novo) => replaceItem(r.id, itemId, novo)}
                      onDeleteItem={(itemId) => deleteItem(r.id, itemId)}
                      onReorderItens={(novaOrdem) => reorderItens(r.id, novaOrdem)}
                      onDeleteRefeicao={() => deleteRefeicao(r.id)}
                      onDuplicarRefeicao={() => duplicarRefeicao(r.id)}
                      onCompletarIA={() => completarRefeicao(r)}
                      onAlternativaIA={() => alternativaRefeicao(r)}
                      onSubstituirIA={() => substituirRefeicao(r)}
                      onMoverCima={() => moverRefeicao(r.id, "up")}
                      onMoverBaixo={() => moverRefeicao(r.id, "down")}
                      podeSubir={idx > 0}
                      podeDescer={idx < plano!.refeicoes.length - 1}
                    />
                  ))}
                </div>
              )}
            </div>

            <StatusInteligente sinais={sinais} />
          </div>

          {/* Coluna direita — resumo + alertas */}
          <div className="lg:col-span-1 lg:sticky lg:top-6 lg:self-start">
            <ResumoNutrientesCard
              total={
                modoPlano !== "texto_livre" && totalItensZero && macrosDaDescricao
                  ? macrosDaDescricao
                  : total
              }
              peso={plano.peso_referencia ?? aluno.peso_kg ?? null}
              vazio={vazio && !macrosDaDescricao}
              alertasCount={alertasCount}
              editavel={modoPlano === "texto_livre" && canEdit && !macrosDaDescricao}
              valoresManuais={modoPlano === "texto_livre" ? totaisExibidos : undefined}
              onChangeManuais={modoPlano === "texto_livre" && !macrosDaDescricao ? patchTotaisManuais : undefined}
              fonte={fonteResumo}
            />
          </div>
        </div>
      )}

      {!plano && (
        <div className="rounded-2xl bg-white border border-slate-200/70 shadow-sm">
          <SeletorModoPlano canEdit={canEdit} onEscolher={(m) => criarPlanoComModo(m)} />
        </div>
      )}

      {plano && (
        <RodapeFixo
          total={total}
          sinais={sinais}
          salvando={salvando}
          canEdit={canEdit}
          onSalvarRascunho={() => salvarStatus("rascunho")}
          onSalvarAtivo={() => salvarStatus("ativo")}
          modo={modoPlano}
          totaisManuais={modoPlano === "texto_livre" ? totaisExibidos : undefined}
        />
      )}

      <WizardMpDiet
        open={openWizard}
        onClose={() => setOpenWizard(false)}
        onSubmit={handleWizardSubmit}
        busy={busyIA}
        defaults={{ peso: plano?.peso_referencia ?? undefined }}
      />
      <ImportarTextoModal
        open={openImport}
        onClose={() => { setOpenImport(false); setPreviewImport(null); }}
        onAnalisar={handleAnalisarTexto}
        onAplicar={handleAplicarImport}
        onAplicarTextoLivre={handleAplicarImportTextoLivre}
        busy={false}
        preview={previewImport}
      />
      <TemplateModal
        open={openTemplate}
        onClose={() => setOpenTemplate(false)}
        onCarregar={carregarTemplate}
        onSalvarComoTemplate={salvarComoTemplate}
        canEdit={canEdit}
      />
      <NovaRefeicaoModal
        open={openNovaRefeicao}
        onClose={() => setOpenNovaRefeicao(false)}
        onSalvar={criarRefeicaoCompleta}
        defaultHorario={proximoHorarioSlot(plano?.refeicoes ?? [])}
        defaultNome={proximaRefeicaoNome(plano?.refeicoes ?? [])}
      />
      {editRefId && (() => {
        const ref = plano?.refeicoes.find((r) => r.id === editRefId);
        if (!ref) return null;
        const parsed = parseRefeicaoObs(ref.observacoes);
        const itensIniciais: NovoItemComSubs[] = ref.itens.map((i) => ({
          alimento_id: i.alimento_id,
          nome_custom: i.nome_custom ?? "Alimento",
          quantidade: Number(i.quantidade),
          unidade: i.unidade,
          kcal: Number(i.kcal), ptn: Number(i.ptn), cho: Number(i.cho), lip: Number(i.lip),
          substitutos: (i.substitutos ?? []).map((s) => ({
            alimento_id: s.alimento_id,
            nome_custom: s.nome_custom ?? "Alimento",
            quantidade: Number(s.quantidade),
            unidade: s.unidade,
            kcal: Number(s.kcal), ptn: Number(s.ptn), cho: Number(s.cho), lip: Number(s.lip),
          })),
        }));
        return (
          <NovaRefeicaoModal
            open={true}
            onClose={() => setEditRefId(null)}
            onSalvar={(payload) => editarRefeicaoCompleta(editRefId, payload)}
            defaultAba={parsed.modo}
            defaultHorario={ref.horario ?? "07:00"}
            defaultNome={ref.nome}
            defaultObs={parsed.observacao}
            defaultItensHtml={parsed.conteudo}
            defaultItens={itensIniciais}
            mode="edit"
          />
        );
      })()}
    </div>
  );
}

function refToIA(ref: RefeicaoCompleta): RefeicaoIA {
  return {
    nome: ref.nome,
    horario: ref.horario,
    observacoes: ref.observacoes,
    itens: ref.itens.map((i) => ({
      nome: i.nome_custom ?? "",
      quantidade: Number(i.quantidade),
      unidade: i.unidade,
      kcal: Number(i.kcal),
      ptn: Number(i.ptn),
      cho: Number(i.cho),
      lip: Number(i.lip),
    })),
  };
}

const SLOTS = ["07:00", "10:00", "12:30", "15:30", "17:00", "19:00", "20:00", "22:00"];
const NOMES = ["Café da manhã", "Lanche da manhã", "Almoço", "Lanche da tarde", "Pré-treino", "Pós-treino", "Jantar", "Ceia"];

function proximoHorarioSlot(refs: RefeicaoCompleta[]): string {
  const usados = new Set(refs.map((r) => r.horario).filter(Boolean) as string[]);
  return SLOTS.find((s) => !usados.has(s)) ?? "12:00";
}

function proximaRefeicaoNome(refs: RefeicaoCompleta[]): string {
  return `Refeição ${refs.length + 1}`;
}

/**
 * Divide o texto colado em blocos por refeição, preservando o texto cru
 * de cada bloco (sem parsear itens). Usa heurística simples: linhas que
 * contêm palavras-chave de refeição ou estão em formato "Nome - HHhMM".
 */
function splitBlocosTexto(texto: string): { nome: string; horario: string | null; conteudo: string }[] {
  const KEYWORDS = ["café", "cafe", "almoço", "almoco", "jantar", "lanche", "ceia", "pré", "pre", "pós", "pos", "refeição", "refeicao", "desjejum", "colação", "colacao"];
  const ORARIO_RE = /(\d{1,2})[:hH](\d{0,2})/;
  const linhas = texto.split(/\r?\n/);
  type Bloco = { nome: string; horario: string | null; linhas: string[] };
  const out: Bloco[] = [];
  let atual: Bloco | null = null;

  function isCabecalho(l: string): boolean {
    const low = l.toLowerCase().trim();
    if (!low) return false;
    if (low.length > 80) return false;
    return KEYWORDS.some((k) => low.includes(k));
  }
  function extrairHorario(l: string): string | null {
    const m = l.match(ORARIO_RE);
    if (!m) return null;
    const h = String(parseInt(m[1], 10)).padStart(2, "0");
    const min = (m[2] || "00").padStart(2, "0");
    return `${h}:${min}`;
  }
  function limparNome(l: string): string {
    return l.replace(ORARIO_RE, "").replace(/[-—–:|]+/g, " ").replace(/\s+/g, " ").trim();
  }

  for (const linha of linhas) {
    if (isCabecalho(linha)) {
      if (atual) out.push(atual);
      atual = { nome: limparNome(linha) || `Refeição ${out.length + 1}`, horario: extrairHorario(linha), linhas: [] };
    } else if (atual) {
      atual.linhas.push(linha);
    }
  }
  if (atual) out.push(atual);

  // Se não detectou nenhum cabeçalho, cria 1 bloco único com tudo
  if (out.length === 0 && texto.trim()) {
    return [{ nome: "Refeição 1", horario: null, conteudo: texto.trim() }];
  }

  return out.map((b) => ({
    nome: b.nome,
    horario: b.horario,
    conteudo: b.linhas.join("\n").replace(/^\n+|\n+$/g, ""),
  }));
}
