import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Plus, ArrowLeft, ChevronDown, Scale, Menu as MenuIcon,
  Pencil, Eye, FileDown, Printer, Trash2,
} from "lucide-react";
import {
  listAssessmentsByStudent, getAssessmentFull, deleteAssessment,
  type PhysicalAssessment,
} from "@/lib/avaliacao-fisica";
import { EvolucaoChart } from "./EvolucaoChart";
import { ComparacaoAvaliacoes } from "./ComparacaoAvaliacoes";
import { AvaliacaoForm } from "@/components/avaliacao/AvaliacaoForm";
import { exportarAvaliacaoPdf } from "@/lib/avaliacao-pdf";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

export function AvaliacaoFisicaTab({ alunoId }: { alunoId: string }) {
  const nav = useNavigate();
  const [list, setList] = useState<PhysicalAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [aluno, setAluno] = useState<{ id: string; nome: string } | null>(null);
  const [colapsado, setColapsado] = useState(false);

  function reload() {
    setLoading(true);
    listAssessmentsByStudent(alunoId).then((d) => { setList(d); setLoading(false); });
  }

  useEffect(() => { reload(); }, [alunoId]);

  useEffect(() => {
    supabase
      .from("alunos")
      .select("id, nome")
      .eq("id", alunoId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setAluno({ id: data.id as string, nome: data.nome as string });
      });
  }, [alunoId]);

  // Ordenado por data ASC para numerar as avaliações (1ª, 2ª, ...).
  // A lista exibida fica em ordem decrescente.
  const sortedAsc = [...list].sort(
    (a, b) => +new Date(a.assessment_date) - +new Date(b.assessment_date),
  );
  const numeroPorId = new Map<string, number>();
  sortedAsc.forEach((r, i) => numeroPorId.set(r.id, i + 1));
  const sortedDesc = [...sortedAsc].reverse();

  async function handleSalvarPdf(id: string) {
    if (!aluno) return;
    try {
      const full = await getAssessmentFull(id);
      if (!full) { toast.error("Avaliação não encontrada"); return; }
      const idx = sortedAsc.findIndex((r) => r.id === id);
      const anterior = idx > 0 ? sortedAsc[idx - 1] : null;
      exportarAvaliacaoPdf({ full, aluno, anterior });
    } catch (e) {
      toast.error("Erro ao gerar PDF");
    }
  }

  async function handleRemover(id: string) {
    if (!confirm("Remover esta avaliação? Esta ação não pode ser desfeita.")) return;
    try {
      await deleteAssessment(id);
      toast.success("Avaliação removida");
      reload();
    } catch (e) {
      toast.error("Erro ao remover");
    }
  }

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Carregando...</div>;

  if (creating) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setCreating(false)}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar para avaliações
          </button>
          <h2 className="text-lg font-semibold">Nova avaliação física</h2>
        </div>
        <AvaliacaoForm
          alunoId={alunoId}
          onSaved={() => { setCreating(false); reload(); }}
          onCancel={() => setCreating(false)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Cabeçalho com Nova avaliação */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Avaliação Física</h2>
        <button onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="h-3.5 w-3.5" /> Nova avaliação
        </button>
      </div>

      {/* Lista no estilo Dietbox */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
          <button
            onClick={() => setColapsado((v) => !v)}
            className="flex items-center gap-2 text-left hover:text-primary transition-colors"
          >
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform ${colapsado ? "-rotate-90" : ""}`}
            />
            <span className="text-sm md:text-base font-semibold">
              Avaliações antropométricas{" "}
              <span className="text-muted-foreground font-normal">({list.length})</span>
            </span>
          </button>
          <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground">
            <a href="#evolucao-chart" className="hover:text-primary">Gráficos ▾</a>
            <a href="#comparativo" className="hover:text-primary">Comparativos ▾</a>
          </div>
        </div>

        {!colapsado && (
          <div>
            {sortedDesc.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Nenhuma avaliação registrada para este aluno.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {sortedDesc.map((r) => {
                  const numero = numeroPorId.get(r.id) ?? 0;
                  return (
                    <li key={r.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                      <div className="h-9 w-9 rounded-full bg-sky-100 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                        <Scale className="h-4 w-4" />
                      </div>
                      <button
                        onClick={() => nav({ to: "/avaliacao-fisica/$id", params: { id: r.id } })}
                        className="text-sm text-foreground hover:text-primary text-left flex-1 min-w-0 truncate"
                      >
                        {numero}ª Avaliação Física
                      </button>
                      <span className="hidden sm:inline-flex text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        disponível no app
                      </span>
                      <span className="text-xs sm:text-sm text-muted-foreground tabular-nums shrink-0">
                        {new Date(r.assessment_date).toLocaleDateString("pt-BR")}
                      </span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className="inline-flex items-center gap-0.5 rounded-md p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                            aria-label="Ações"
                          >
                            <MenuIcon className="h-4 w-4" />
                            <ChevronDown className="h-3 w-3" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => nav({ to: "/avaliacao-fisica/$id/editar", params: { id: r.id } })}>
                            <Pencil className="h-3.5 w-3.5 mr-2" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => nav({ to: "/avaliacao-fisica/$id", params: { id: r.id } })}>
                            <Eye className="h-3.5 w-3.5 mr-2" /> Visualizar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleSalvarPdf(r.id)}>
                            <FileDown className="h-3.5 w-3.5 mr-2" /> Salvar em PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleSalvarPdf(r.id)}>
                            <Printer className="h-3.5 w-3.5 mr-2" /> Imprimir
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-rose-600 focus:text-rose-600"
                            onClick={() => handleRemover(r.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-2" /> Remover
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      <div id="evolucao-chart">
        <EvolucaoChart list={list} />
      </div>

      <div id="comparativo">
        <ComparacaoAvaliacoes list={list} aluno={aluno} />
      </div>
    </div>
  );
}