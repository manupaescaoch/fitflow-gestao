import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RespostasLegivel } from "@/components/aluno/RespostasLegivel";
import { ArrowLeft, Printer, Loader2, AlertTriangle, UserPlus } from "lucide-react";
import { fmtDateTime } from "@/lib/crm";
import { useAuth } from "@/lib/auth";
import { buscarAlunoPorTelefone, criarAlunoViaAnamneseDetalhado, normalizarTelefone } from "@/lib/aluno-publico";
import { toast } from "sonner";

export const Route = createFileRoute("/formularios/$id/respostas")({
  component: RespostasPage,
});

type FormRow = {
  id: string;
  tipo: string;
  criado_em: string | null;
  respondido_em: string | null;
  respondido: boolean;
  dados_resposta: any;
  aluno_id: string | null;
};

const TIPO_LABEL: Record<string, string> = {
  anamnese: "Anamnese",
  feedback_quinzenal: "Feedback Quinzenal",
  feedback_mensal: "Feedback Mensal",
};

function RespostasPage() {
  const { id } = Route.useParams();
  const { loading: authLoading, session } = useAuth();
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [form, setForm] = useState<FormRow | null>(null);
  const [alunoNome, setAlunoNome] = useState<string | null>(null);
  const [vinculando, setVinculando] = useState(false);
  const [vincErro, setVincErro] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !session) nav({ to: "/login" });
  }, [authLoading, session, nav]);

  useEffect(() => {
    if (authLoading || !session) return;
    let cancelado = false;
    void (async () => {
      setLoading(true);
      setErro(null);
      try {
        const { data, error } = await supabase
          .from("formularios")
          .select("id, tipo, criado_em, respondido_em, respondido, dados_resposta, aluno_id")
          .eq("id", id)
          .maybeSingle();
        if (error || !data) {
          if (!cancelado) setErro("Formulário não encontrado.");
          return;
        }
        if (!cancelado) setForm(data as FormRow);
        if (data.aluno_id) {
          const { data: a } = await supabase
            .from("alunos")
            .select("nome")
            .eq("id", data.aluno_id)
            .maybeSingle();
          if (!cancelado && a?.nome) setAlunoNome(a.nome as string);
        }
      } catch {
        if (!cancelado) setErro("Erro ao carregar respostas.");
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();
    return () => { cancelado = true; };
  }, [id, authLoading, session]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando…
      </div>
    );
  }

  if (!session) return null;

  if (erro || !form) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <p className="text-sm text-muted-foreground">{erro ?? "Formulário não encontrado."}</p>
      </div>
    );
  }

  const tipoLabel = TIPO_LABEL[form.tipo] ?? form.tipo;
  const dp = (form.dados_resposta?.dados_pessoais ?? form.dados_resposta?.identificacao ?? {}) as any;
  const telOrfao = normalizarTelefone(String(dp?.telefone ?? ""));
  const nomeOrfao = String(dp?.nome ?? dp?.nome_completo ?? "").trim();

  async function vincularOuCriar() {
    if (!form) return;
    setVinculando(true);
    setVincErro(null);
    try {
      let alunoId: string | null = null;
      let alunoNomeMatch: string | null = null;
      let criado = false;
      if (telOrfao) {
        const existente = await buscarAlunoPorTelefone(telOrfao);
        if (existente) { alunoId = existente.id; alunoNomeMatch = existente.nome; }
      }
      if (!alunoId && nomeOrfao && telOrfao) {
        const novo = await criarAlunoViaAnamneseDetalhado({
          nome: nomeOrfao,
          telefone: telOrfao,
          email: dp?.email ?? null,
        });
        if (novo.error) { setVincErro(novo.error); setVinculando(false); return; }
        alunoId = novo.id;
        alunoNomeMatch = nomeOrfao;
        criado = true;
      }
      if (!alunoId) { setVincErro("Sem dados suficientes para criar o aluno."); setVinculando(false); return; }
      const { error: e1 } = await supabase.from("formularios").update({ aluno_id: alunoId }).eq("id", form.id);
      if (e1) { setVincErro(e1.message); setVinculando(false); return; }
      if (form.tipo === "anamnese") {
        await supabase.from("alunos").update({ data_anamnese: form.respondido_em || new Date().toISOString(), status: "anamnese_recebida" }).eq("id", alunoId);
        await supabase.from("historico_status").insert({ aluno_id: alunoId, status_de: "aguardando_anamnese", status_para: "anamnese_recebida", alterado_por: "vinculacao_manual" });
      }
      toast.success(
        criado ? `Aluno criado: ${alunoNomeMatch}` : `Vinculado ao aluno: ${alunoNomeMatch}`,
        { description: criado ? "Novo cadastro feito a partir da resposta." : "Resposta vinculada com sucesso." }
      );
      nav({ to: "/alunos/$id", params: { id: alunoId } });
    } catch (e: any) {
      setVincErro(e?.message || "Falha ao vincular");
    } finally {
      setVinculando(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-6 print:py-2">
        <div className="flex items-center justify-between gap-2 mb-4 print:hidden">
          {form.aluno_id ? (
            <Link
              to="/alunos/$id"
              params={{ id: form.aluno_id }}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> Voltar para o aluno
            </Link>
          ) : <span />}
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted"
          >
            <Printer className="h-3.5 w-3.5" /> Imprimir
          </button>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          {form.respondido && !form.aluno_id && (
            <div className="mb-5 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 print:hidden">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-amber-900 dark:text-amber-200">Resposta sem aluno vinculado</p>
                  <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                    Esta resposta foi salva, mas o cadastro do aluno falhou no envio. Você pode vincular ou criar o aluno agora.
                  </p>
                  {vincErro && <p className="text-xs text-red-600 mt-2">{vincErro}</p>}
                  <button
                    onClick={vincularOuCriar}
                    disabled={vinculando || (!nomeOrfao && !telOrfao)}
                    className="mt-3 inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-60"
                  >
                    {vinculando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                    {vinculando ? "Vinculando…" : "Vincular ou criar aluno"}
                  </button>
                </div>
              </div>
            </div>
          )}
          <div className="flex items-start justify-between flex-wrap gap-3 pb-4 mb-5 border-b border-border">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">{tipoLabel}</h1>
              {alunoNome && (
                <p className="text-sm text-muted-foreground mt-0.5">{alunoNome}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Criado em {fmtDateTime(form.criado_em)}
                {form.respondido_em && ` · Respondido em ${fmtDateTime(form.respondido_em)}`}
              </p>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full ${form.respondido ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/15 text-amber-600 dark:text-amber-400"}`}>
              {form.respondido ? "Respondido" : "Pendente"}
            </span>
          </div>

          {form.respondido && form.dados_resposta ? (
            <RespostasLegivel tipo={form.tipo} dados={form.dados_resposta} />
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Este formulário ainda não foi respondido.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
