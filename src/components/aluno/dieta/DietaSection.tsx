import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import type { Aluno } from "@/lib/crm";
import { DietaCockpit, type DietaHeaderActions } from "./DietaCockpit";
import { DietaOverview } from "./DietaOverview";
import { PrescricoesSection } from "@/components/aluno/PrescricoesSection";
import { MensagemNutricionalCard } from "./MensagemNutricionalCard";
import { DietaHeaderRico } from "./DietaHeaderRico";
import { AlertasInteligentes } from "./AlertasInteligentes";
import { HistoricoRecenteCard } from "./HistoricoRecenteCard";
import { supabase } from "@/integrations/supabase/client";
import { exportarPdfDieta } from "@/lib/dieta-pdf/gerar";
import { parseObservacoesField } from "@/lib/prescricao";
import type { DietaPlano, DietaRefeicao, DietaItem, DietaItemComSubs, ItemSub, PlanoCompleto } from "@/lib/dieta";

type View = "list" | "edit-plano" | "edit-presc";

export function DietaSection({
  alunoId, aluno, canEdit, onActionsChange,
}: {
  alunoId: string;
  aluno: Aluno;
  canEdit: boolean;
  onActionsChange?: (actions: DietaHeaderActions) => void;
}) {
  const [view, setView] = useState<View>("list");
  const [busyPdf, setBusyPdf] = useState(false);

  // Listener para o botão "Adicionar" do header do aluno
  useEffect(() => {
    function onAdd(e: Event) {
      const detail = (e as CustomEvent<{ tipo: "dieta" | "prescricao" }>).detail;
      if (!canEdit) return;
      if (detail?.tipo === "dieta") setView("edit-plano");
      else if (detail?.tipo === "prescricao") setView("edit-presc");
    }
    window.addEventListener("aluno-add-action", onAdd as EventListener);
    return () => window.removeEventListener("aluno-add-action", onAdd as EventListener);
  }, [canEdit]);

  function handleWhatsApp() {
    const num = (aluno.whatsapp ?? "").replace(/\D+/g, "");
    if (!num) { toast.error("Aluno sem WhatsApp"); return; }
    const msg = encodeURIComponent(`Olá ${aluno.nome.split(" ")[0]}, segue uma atualização da sua dieta.`);
    window.open(`https://wa.me/${num}?text=${msg}`, "_blank");
  }

  async function handleSalvarPdf() {
    if (busyPdf) return;
    setBusyPdf(true);
    try {
      const { data: planos } = await supabase
        .from("dieta_planos").select("*")
        .eq("aluno_id", alunoId).eq("template", false).neq("status", "arquivado")
        .order("atualizado_em", { ascending: false }).limit(1);
      const plano = (planos?.[0] as DietaPlano | undefined) ?? null;
      if (!plano) { toast.error("Nenhum plano alimentar para exportar"); return; }
      const { data: refs } = await supabase.from("dieta_refeicoes").select("*").eq("plano_id", plano.id).order("ordem");
      const refList = (refs ?? []) as DietaRefeicao[];
      const ids = refList.map((r) => r.id);
      let itemList: DietaItem[] = [];
      const subsByItem = new Map<string, ItemSub[]>();
      if (ids.length) {
        const { data: itens } = await supabase.from("dieta_itens").select("*").in("refeicao_id", ids).order("ordem");
        itemList = (itens ?? []) as DietaItem[];
        const itemIds = itemList.map((i) => i.id);
        if (itemIds.length) {
          const { data: subs } = await supabase.from("dieta_item_substitutos").select("*").in("item_id", itemIds).order("ordem");
          ((subs ?? []) as ItemSub[]).forEach((s) => {
            const arr = subsByItem.get(s.item_id) ?? []; arr.push(s); subsByItem.set(s.item_id, arr);
          });
        }
      }
      const completo: PlanoCompleto = {
        ...plano,
        refeicoes: refList.map((r) => ({
          ...r,
          itens: itemList.filter((i) => i.refeicao_id === r.id).map<DietaItemComSubs>((i) => ({
            ...i, substitutos: subsByItem.get(i.id) ?? [],
          })),
        })),
      };
      exportarPdfDieta(completo, aluno);
      toast.success("PDF gerado");
    } catch (e) {
      console.error(e);
      toast.error("Falha ao gerar PDF");
    } finally {
      setBusyPdf(false);
    }
  }

  if (view === "edit-plano") {
    return (
      <div className="space-y-3">
        <button
          onClick={() => setView("list")}
          className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar para visão geral
        </button>
        <DietaCockpit alunoId={alunoId} aluno={aluno} canEdit={canEdit} onActionsChange={onActionsChange} />
      </div>
    );
  }

  if (view === "edit-presc") {
    return (
      <div className="space-y-3">
        <button
          onClick={() => setView("list")}
          className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar para visão geral
        </button>
        <PrescricoesSection alunoId={alunoId} aluno={aluno} canEdit={canEdit} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DietaHeaderRico
        aluno={aluno}
        onWhatsApp={handleWhatsApp}
        onGerarFeedback={() => {
          const el = document.getElementById("assistente-nutricional");
          el?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
        onAtualizarDieta={() => setView("edit-plano")}
        onSalvarPdf={handleSalvarPdf}
        busyPdf={busyPdf}
      />
      <AlertasInteligentes alunoId={alunoId} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <DietaOverview
            alunoId={alunoId}
            aluno={aluno}
            canEdit={canEdit}
            onEditarPlano={() => setView("edit-plano")}
            onEditarPrescricao={() => setView("edit-presc")}
            onCriarPlano={() => setView("edit-plano")}
          />
          <div id="assistente-nutricional">
            <MensagemNutricionalCard
              alunoId={alunoId}
              nomeAluno={aluno.nome}
              whatsapp={aluno.whatsapp}
            />
          </div>
        </div>
        <div className="lg:col-span-1">
          <HistoricoRecenteCard alunoId={alunoId} />
        </div>
      </div>
    </div>
  );
}