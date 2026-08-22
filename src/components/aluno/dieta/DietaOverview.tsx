import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ChevronDown, ChevronRight, UtensilsCrossed, Pill, MoreHorizontal,
  MessageCircle, FileDown, Printer, Eye, Loader2, Plus, Archive, Pencil, Trash2,
  BookmarkPlus, Users,
} from "lucide-react";
import type { Aluno } from "@/lib/crm";
import type { DietaPlano, RefeicaoCompleta, PlanoCompleto, DietaItem, DietaItemComSubs, ItemSub, DietaRefeicao } from "@/lib/dieta";
import { parseObservacoesField, type PrescricaoCompleta } from "@/lib/prescricao";
import { exportarPdfDieta } from "@/lib/dieta-pdf/gerar";
import { DietaVisualizarModal } from "./DietaVisualizarModal";
import { ReplicarPlanoModal } from "./modals/ReplicarPlanoModal";
import { clonarPlano } from "@/lib/dieta-clone";

type PlanoLite = DietaPlano;

export function DietaOverview({
  alunoId, aluno, canEdit, onEditarPlano, onEditarPrescricao, onCriarPlano, compact,
}: {
  alunoId: string;
  aluno: Aluno;
  canEdit: boolean;
  onEditarPlano: () => void;
  onEditarPrescricao: () => void;
  onCriarPlano: () => void;
  compact?: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [plano, setPlano] = useState<PlanoLite | null>(null);
  const [prescricao, setPrescricao] = useState<PrescricaoCompleta | null>(null);
  const [openPlanoSection, setOpenPlanoSection] = useState(true);
  const [openPrescSection, setOpenPrescSection] = useState(true);
  const [planoMenu, setPlanoMenu] = useState(false);
  const [prescMenu, setPrescMenu] = useState(false);
  const [visualizar, setVisualizar] = useState(false);
  const [planoCompleto, setPlanoCompleto] = useState<PlanoCompleto | null>(null);
  const [busyVisualizar, setBusyVisualizar] = useState(false);
  const [busyPdf, setBusyPdf] = useState(false);
  const [replicarOpen, setReplicarOpen] = useState(false);
  const [busySalvarBiblio, setBusySalvarBiblio] = useState(false);
  const planoMenuRef = useRef<HTMLDivElement>(null);
  const prescMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { void carregar(); }, [alunoId]);

  useEffect(() => {
    function on(e: MouseEvent) {
      if (planoMenuRef.current && !planoMenuRef.current.contains(e.target as Node)) setPlanoMenu(false);
      if (prescMenuRef.current && !prescMenuRef.current.contains(e.target as Node)) setPrescMenu(false);
    }
    document.addEventListener("mousedown", on);
    return () => document.removeEventListener("mousedown", on);
  }, []);

  async function carregar() {
    setLoading(true);
    const { data } = await supabase
      .from("dieta_planos")
      .select("*")
      .eq("aluno_id", alunoId)
      .eq("template", false)
      .neq("status", "arquivado")
      .order("atualizado_em", { ascending: false })
      .limit(1);
    const p = (data?.[0] as PlanoLite | undefined) ?? null;
    setPlano(p);
    if (p) {
      const parsed = parseObservacoesField(p.observacoes);
      setPrescricao(parsed.prescricao);
    } else {
      setPrescricao(null);
    }
    setLoading(false);
  }

  async function loadPlanoCompleto(): Promise<PlanoCompleto | null> {
    if (!plano) return null;
    const { data: refs } = await supabase
      .from("dieta_refeicoes").select("*")
      .eq("plano_id", plano.id).order("ordem");
    const refList = (refs ?? []) as DietaRefeicao[];
    if (!refList.length) return { ...plano, refeicoes: [] };
    const ids = refList.map((r) => r.id);
    const { data: itens } = await supabase
      .from("dieta_itens").select("*").in("refeicao_id", ids).order("ordem");
    const itemList = (itens ?? []) as DietaItem[];
    const itemIds = itemList.map((i) => i.id);
    const subsByItem = new Map<string, ItemSub[]>();
    if (itemIds.length) {
      const { data: subs } = await supabase
        .from("dieta_item_substitutos").select("*").in("item_id", itemIds).order("ordem");
      ((subs ?? []) as ItemSub[]).forEach((s) => {
        const arr = subsByItem.get(s.item_id) ?? [];
        arr.push(s);
        subsByItem.set(s.item_id, arr);
      });
    }
    return {
      ...plano,
      refeicoes: refList.map((r) => ({
        ...r,
        itens: itemList.filter((i) => i.refeicao_id === r.id).map<DietaItemComSubs>((i) => ({
          ...i, substitutos: subsByItem.get(i.id) ?? [],
        })),
      })),
    };
  }

  async function arquivarPlano() {
    if (!plano) return;
    if (!confirm("Arquivar este plano alimentar?")) return;
    const { error } = await supabase
      .from("dieta_planos")
      .update({ status: "arquivado" })
      .eq("id", plano.id);
    if (error) { toast.error("Erro ao arquivar"); return; }
    toast.success("Plano arquivado");
    setPlanoMenu(false);
    void carregar();
  }

  async function salvarNaBiblioteca() {
    if (!plano || busySalvarBiblio) return;
    const sugestao = plano.nome || `Cardápio de ${aluno.nome.split(" ")[0]}`;
    const nome = window.prompt("Nome do cardápio na biblioteca:", sugestao);
    if (!nome || !nome.trim()) return;
    setBusySalvarBiblio(true);
    try {
      await clonarPlano({
        origemPlanoId: plano.id,
        destino: { tipo: "template", nome: nome.trim() },
      });
      toast.success("Cardápio salvo na biblioteca");
      setPlanoMenu(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar na biblioteca");
    } finally {
      setBusySalvarBiblio(false);
    }
  }

  function abrirReplicar() {
    setPlanoMenu(false);
    setReplicarOpen(true);
  }

  async function removerPrescricao() {
    if (!plano) return;
    if (!confirm("Remover esta prescrição?")) return;
    const parsed = parseObservacoesField(plano.observacoes);
    const novoCampo = parsed.observacoesLivres || null;
    const { error } = await supabase
      .from("dieta_planos")
      .update({ observacoes: novoCampo })
      .eq("id", plano.id);
    if (error) { toast.error("Erro ao remover"); return; }
    toast.success("Prescrição removida");
    setPrescMenu(false);
    void carregar();
  }

  async function handleVisualizar() {
    if (!plano || busyVisualizar) return;
    setBusyVisualizar(true);
    const completo = await loadPlanoCompleto();
    setBusyVisualizar(false);
    if (!completo) { toast.error("Erro ao carregar plano"); return; }
    setPlanoCompleto(completo);
    setVisualizar(true);
  }

  async function handleSalvarPdf() {
    if (!plano || busyPdf) return;
    setBusyPdf(true);
    try {
      const completo = await loadPlanoCompleto();
      if (!completo) { toast.error("Erro ao carregar plano"); return; }
      exportarPdfDieta(completo, aluno);
      toast.success("PDF gerado");
    } catch (e) {
      toast.error("Falha ao gerar PDF");
      console.error(e);
    } finally {
      setBusyPdf(false);
    }
  }

  function handleWhatsApp() {
    const num = (aluno.whatsapp ?? "").replace(/\D+/g, "");
    if (!num) { toast.error("Aluno sem WhatsApp"); return; }
    const msg = encodeURIComponent(`Olá ${aluno.nome.split(" ")[0]}, segue seu plano alimentar atualizado.`);
    window.open(`https://wa.me/${num}?text=${msg}`, "_blank");
  }

  async function handleImprimir() {
    await handleVisualizar();
    setTimeout(() => window.print(), 400);
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-10 flex items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando…
      </div>
    );
  }

  const dataPlano = plano ? new Date(plano.atualizado_em).toLocaleDateString("pt-BR") : "";
  const diasLabel = plano ? formatDias(plano.dias_semana) : "";
  const resumoPlano = plano ? formatResumoPlano(plano, aluno) : "";

  return (
    <div className="space-y-4">
      {/* Card Plano alimentar */}
      <div className="rounded-xl border border-border bg-card overflow-visible">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3 flex-wrap">
          <button
            onClick={() => setOpenPlanoSection((v) => !v)}
            className="flex items-center gap-2 text-sm font-semibold text-slate-800 hover:text-slate-900"
          >
            {openPlanoSection ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            Plano alimentar
          </button>
          {plano && canEdit && !compact && (
            <div className="flex items-center gap-1 flex-wrap">
              <ActionBtn icon={MessageCircle} label="WhatsApp" onClick={handleWhatsApp} />
              <ActionBtn icon={FileDown} label="Salvar em PDF" onClick={handleSalvarPdf} busy={busyPdf} />
              <ActionBtn icon={Printer} label="Imprimir" onClick={handleImprimir} />
              <ActionBtn icon={Eye} label="Visualizar" onClick={handleVisualizar} busy={busyVisualizar} />
            </div>
          )}
        </div>

        {openPlanoSection && (
          <div>
            {!plano ? (
              <div className="p-8 text-center">
                <UtensilsCrossed className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground mb-4">Nenhum plano alimentar criado.</p>
                {canEdit && (
                  <button
                    onClick={onCriarPlano}
                    className="inline-flex items-center gap-2 rounded-md bg-primary hover:bg-primary text-white px-4 py-2 text-sm font-semibold"
                  >
                    <Plus className="h-4 w-4" /> Criar plano alimentar
                  </button>
                )}
              </div>
            ) : (
              <div
                role={canEdit ? "button" : undefined}
                tabIndex={canEdit ? 0 : undefined}
                onClick={() => { if (canEdit) onEditarPlano(); else handleVisualizar(); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    if (canEdit) onEditarPlano(); else handleVisualizar();
                  }
                }}
                className="px-4 py-3 flex items-center gap-3 hover:bg-slate-50/60 transition-colors cursor-pointer"
              >
                <div className="h-9 w-9 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center shrink-0">
                  <UtensilsCrossed className="h-4 w-4" />
                </div>
                <div className="flex items-center gap-1.5 flex-wrap min-w-0 flex-1">
                  {renderDiasPills(plano.dias_semana)}
                  {plano.meta_kcal ? (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-medium whitespace-nowrap">
                      {Math.round(Number(plano.meta_kcal))} kcal
                    </span>
                  ) : null}
                  <span className="text-sm text-slate-500 truncate min-w-0">{resumoPlano}</span>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">{dataPlano}</span>
                {canEdit && (
                  <div className="relative" ref={planoMenuRef} onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setPlanoMenu((v) => !v)}
                      className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md bg-primary hover:bg-primary text-white text-xs font-medium"
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                      <ChevronDown className="h-3 w-3" />
                    </button>
                    {planoMenu && (
                      <div className="absolute right-0 mt-1 w-56 rounded-lg border border-slate-200 bg-white shadow-lg z-30 overflow-hidden">
                        <MenuItem icon={Pencil} label="Editar" onClick={() => { setPlanoMenu(false); onEditarPlano(); }} />
                        <MenuItem icon={BookmarkPlus} label="Salvar na biblioteca" onClick={salvarNaBiblioteca} />
                        <MenuItem icon={Users} label="Replicar para aluno" onClick={abrirReplicar} />
                        <MenuItem icon={Archive} label="Arquivar plano alimentar" onClick={arquivarPlano} tone="warn" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Card Prescrições */}
      <div className="rounded-xl border border-border bg-card overflow-visible">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <button
            onClick={() => setOpenPrescSection((v) => !v)}
            className="flex items-center gap-2 text-sm font-semibold text-slate-800 hover:text-slate-900"
          >
            {openPrescSection ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            Prescrições ({prescricao ? 1 : 0})
          </button>
        </div>

        {openPrescSection && (
          <div>
            {!prescricao ? (
              <div className="p-6 text-center">
                <Pill className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground mb-3">Nenhuma prescrição.</p>
                {canEdit && (
                  <button
                    onClick={onEditarPrescricao}
                    className="inline-flex items-center gap-2 rounded-md bg-primary hover:bg-primary text-white px-4 py-2 text-sm font-semibold"
                  >
                    <Plus className="h-4 w-4" /> Criar Prescrição
                  </button>
                )}
              </div>
            ) : (
              <div
                role={canEdit ? "button" : undefined}
                tabIndex={canEdit ? 0 : undefined}
                onClick={() => { if (canEdit) onEditarPrescricao(); }}
                onKeyDown={(e) => {
                  if ((e.key === "Enter" || e.key === " ") && canEdit) {
                    e.preventDefault();
                    onEditarPrescricao();
                  }
                }}
                className="px-4 py-3 flex items-center gap-3 hover:bg-slate-50/60 transition-colors cursor-pointer"
              >
                <div className="h-9 w-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <Pill className="h-4 w-4" />
                </div>
                <p className="flex-1 text-sm text-slate-800 truncate min-w-0">
                  {prescricao.titulo || `Prescrição para ${aluno.nome.split(" ")[0]}`}
                </p>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 font-medium whitespace-nowrap">
                  disponível no app
                </span>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {prescricao.data ? new Date(`${prescricao.data}T00:00:00`).toLocaleDateString("pt-BR") : dataPlano}
                </span>
                {canEdit && (
                  <div className="relative" ref={prescMenuRef} onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setPrescMenu((v) => !v)}
                      className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md bg-primary hover:bg-primary text-white text-xs font-medium"
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                      <ChevronDown className="h-3 w-3" />
                    </button>
                    {prescMenu && (
                      <div className="absolute right-0 mt-1 w-44 rounded-lg border border-slate-200 bg-white shadow-lg z-30 overflow-hidden">
                        <MenuItem icon={Pencil} label="Editar" onClick={() => { setPrescMenu(false); onEditarPrescricao(); }} />
                        <MenuItem icon={Trash2} label="Remover" onClick={removerPrescricao} tone="danger" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <DietaVisualizarModal
        open={visualizar}
        onClose={() => setVisualizar(false)}
        plano={planoCompleto}
        nomeAluno={aluno.nome}
      />

      <ReplicarPlanoModal
        open={replicarOpen}
        onClose={() => setReplicarOpen(false)}
        planoId={plano?.id ?? null}
        alunoOrigemId={alunoId}
      />
    </div>
  );
}

function ActionBtn({
  icon: Icon, label, onClick, busy,
}: { icon: any; label: string; onClick: () => void; busy?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-50"
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}

function MenuItem({
  icon: Icon, label, onClick, tone,
}: { icon: any; label: string; onClick: () => void; tone?: "danger" | "warn" }) {
  const cls = tone === "danger"
    ? "text-rose-600 hover:bg-rose-50"
    : tone === "warn"
    ? "text-amber-700 hover:bg-amber-50"
    : "text-slate-700 hover:bg-slate-50";
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${cls}`}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}

function formatDias(dias: string[] | null | undefined): string {
  if (!dias || dias.length === 0) return "—";
  if (dias.length === 7) return "Todos os dias";
  const map: Record<string, string> = { seg: "Seg", ter: "Ter", qua: "Qua", qui: "Qui", sex: "Sex", sab: "Sáb", dom: "Dom" };
  return dias.map((d) => map[d] ?? d).join(", ");
}

const DIA_LABEL: Record<string, string> = {
  seg: "Segunda", ter: "Terça", qua: "Quarta", qui: "Quinta",
  sex: "Sexta", sab: "Sábado", dom: "Domingo",
};
const DIA_ORDEM = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"];

function renderDiasPills(dias: string[] | null | undefined) {
  const list = (dias ?? []).slice().sort((a, b) => DIA_ORDEM.indexOf(a) - DIA_ORDEM.indexOf(b));
  if (list.length === 0) return null;
  return list.map((d) => (
    <span
      key={d}
      className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-medium whitespace-nowrap"
    >
      {DIA_LABEL[d] ?? d}
    </span>
  ));
}

function formatResumoPlano(p: PlanoLite, aluno: Aluno): string {
  const nomeBase = p.nome || `Plano alimentar para ${aluno.nome.split(" ")[0]}`;
  if (!p.meta_kcal) return nomeBase;
  const peso = p.peso_referencia ?? aluno.peso_kg ?? 0;
  const partes: string[] = [`${Math.round(Number(p.meta_kcal))} kcal`];
  if (p.ptn_g_kg && peso) partes.push(`${Math.round(Number(p.ptn_g_kg) * peso)}g P`);
  if (p.cho_g_kg && peso) partes.push(`${Math.round(Number(p.cho_g_kg) * peso)}g C`);
  if (p.lip_g_kg && peso) partes.push(`${Math.round(Number(p.lip_g_kg) * peso)}g L`);
  return `${nomeBase} - ${partes.join(" | ")}`;
}