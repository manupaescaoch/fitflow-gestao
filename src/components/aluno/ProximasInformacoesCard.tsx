import { useEffect, useState } from "react";
import { Calendar, Clock, MessageSquare, Sparkles, Target, Activity, Eye, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { STATUS_LABEL, fmtDate, type Aluno } from "@/lib/crm";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useServerFn } from "@tanstack/react-start";
import { previewMensagemJob } from "@/server/motor-preview.functions";

type Props = { alunoId: string; aluno: Aluno };

type Tone = "default" | "muted" | "warn" | "ok";
type Status = { label: string; tone: Tone };
type PreviewTipo =
  | "followup_d7"
  | "feedback_quinzenal_link"
  | "followup_d21"
  | "feedback_mensal_link";
type Linha = {
  icon: any;
  label: string;
  value: string;
  tone?: Tone;
  status?: Status;
  previewTipo?: PreviewTipo;
};

const TONE: Record<Tone, string> = {
  default: "text-foreground",
  muted: "text-muted-foreground",
  warn: "text-amber-700",
  ok: "text-emerald-700",
};

const BADGE: Record<Tone, string> = {
  default: "bg-muted text-foreground",
  muted: "bg-muted text-muted-foreground",
  warn: "bg-amber-100 text-amber-800",
  ok: "bg-emerald-100 text-emerald-800",
};

function proximaAcaoEPrazo(aluno: Aluno): { acao: string; prazo: string; sugerida: string } {
  switch (aluno.status) {
    case "aguardando_anamnese":
      return {
        acao: "Aguardar anamnese",
        prazo: "Sem prazo definido",
        sugerida: "Reenviar link de anamnese",
      };
    case "anamnese_recebida":
      return {
        acao: "Gerar dieta e treino",
        prazo: "Até 3 dias úteis após anamnese",
        sugerida: "Atualizar dieta e treino",
      };
    case "em_producao":
      return {
        acao: "Entregar planejamento",
        prazo: "Até 3 dias úteis",
        sugerida: "Finalizar dieta e treino",
      };
    case "ativo":
      return {
        acao: "Acompanhar evolução",
        prazo: "Próximo feedback agendado",
        sugerida: "Conferir feedbacks pendentes",
      };
    case "aguardando_renovacao":
      return {
        acao: "Renovar plano",
        prazo: aluno.data_expiracao ? `Vencimento ${fmtDate(aluno.data_expiracao)}` : "Definir nova data",
        sugerida: "Cobrar renovação",
      };
    case "renovado":
      return {
        acao: "Atualizar planejamento",
        prazo: "Até 3 dias úteis",
        sugerida: "Atualizar dieta e treino",
      };
    case "cancelado":
      return { acao: "—", prazo: "—", sugerida: "Sem ação" };
    default:
      return { acao: "—", prazo: "—", sugerida: "—" };
  }
}

export function ProximasInformacoesCard({ alunoId, aluno }: Props) {
  type JobInfo = { agendado_para: string | null; executado: boolean } | null;
  type Jobs = Record<
    "followup_d7" | "feedback_quinzenal_link" | "followup_d21" | "feedback_mensal_link",
    JobInfo
  >;
  const [jobs, setJobs] = useState<Jobs | undefined>(undefined);
  const previewFn = useServerFn(previewMensagemJob);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTipo, setPreviewTipo] = useState<PreviewTipo | null>(null);
  const [previewMsg, setPreviewMsg] = useState<string | null>(null);
  const [previewErro, setPreviewErro] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  async function abrirPreview(tipo: PreviewTipo) {
    setPreviewTipo(tipo);
    setPreviewMsg(null);
    setPreviewErro(null);
    setPreviewOpen(true);
    setPreviewLoading(true);
    try {
      const r = await previewFn({ data: { alunoId, tipo } });
      setPreviewMsg(r.mensagem);
      setPreviewErro(r.error);
    } catch (e) {
      setPreviewErro(e instanceof Error ? e.message : "Falha ao gerar prévia");
    } finally {
      setPreviewLoading(false);
    }
  }

  useEffect(() => {
    let cancel = false;
    void (async () => {
      const { data } = await supabase
        .from("jobs_disparos")
        .select("tipo, agendado_para, executado, executado_em")
        .eq("aluno_id", alunoId)
        .in("tipo", [
          "followup_d7",
          "feedback_quinzenal_link",
          "followup_d21",
          "feedback_mensal_link",
        ])
        .order("agendado_para", { ascending: false });
      if (cancel) return;
      const pick = (t: string): JobInfo => {
        const rows = (data ?? []).filter((d: any) => d.tipo === t);
        const pendente = rows.find((r: any) => !r.executado);
        const escolhido = pendente ?? rows[0];
        return escolhido
          ? { agendado_para: escolhido.agendado_para, executado: !!escolhido.executado }
          : null;
      };
      setJobs({
        followup_d7: pick("followup_d7"),
        feedback_quinzenal_link: pick("feedback_quinzenal_link"),
        followup_d21: pick("followup_d21"),
        feedback_mensal_link: pick("feedback_mensal_link"),
      });
    })();
    return () => { cancel = true; };
  }, [alunoId]);

  const { acao, prazo, sugerida } = proximaAcaoEPrazo(aluno);

  const proximaOcorrencia = (intervalo: number): string | null => {
    if (!aluno.data_d0) return null;
    const d0 = new Date(aluno.data_d0).getTime();
    const now = Date.now();
    const diasPassados = Math.max(0, Math.floor((now - d0) / 86400000));
    const ciclos = Math.floor(diasPassados / intervalo) + 1;
    return new Date(d0 + ciclos * intervalo * 86400000).toISOString();
  };

  const fmtJob = (
    j: JobInfo | undefined,
    intervalo: number,
  ): { value: string; tone: Tone; status: Status } => {
    if (jobs === undefined) return { value: "…", tone: "muted", status: { label: "…", tone: "muted" } };
    if (j) {
      const data = j.agendado_para ? fmtDate(j.agendado_para) : "—";
      if (j.executado) return { value: data, tone: "muted", status: { label: "Enviado", tone: "ok" } };
      const atrasado = j.agendado_para ? new Date(j.agendado_para).getTime() < Date.now() : false;
      return atrasado
        ? { value: data, tone: "warn", status: { label: "Atrasado", tone: "warn" } }
        : { value: data, tone: "default", status: { label: "Agendado", tone: "default" } };
    }
    const prox = proximaOcorrencia(intervalo);
    if (prox) return { value: fmtDate(prox), tone: "default", status: { label: "Previsto", tone: "muted" } };
    return { value: "Após entrega do plano", tone: "muted", status: { label: "Aguardando D0", tone: "muted" } };
  };

  const fd7 = fmtJob(jobs?.followup_d7, 7);
  const fq = fmtJob(jobs?.feedback_quinzenal_link, 15);
  const fd21 = fmtJob(jobs?.followup_d21, 21);
  const fm = fmtJob(jobs?.feedback_mensal_link, 30);

  const linhas: Linha[] = [
    { icon: Target, label: "Próxima ação", value: acao },
    { icon: Clock, label: "Prazo", value: prazo, tone: "muted" },
    { icon: Calendar, label: "Followup D+7", value: fd7.value, tone: fd7.tone, status: fd7.status, previewTipo: "followup_d7" },
    { icon: Calendar, label: "Feedback quinzenal (D+15)", value: fq.value, tone: fq.tone, status: fq.status, previewTipo: "feedback_quinzenal_link" },
    { icon: Calendar, label: "Followup D+21", value: fd21.value, tone: fd21.tone, status: fd21.status, previewTipo: "followup_d21" },
    { icon: MessageSquare, label: "Feedback mensal (D+30)", value: fm.value, tone: fm.tone, status: fm.status, previewTipo: "feedback_mensal_link" },
    { icon: Activity, label: "Status", value: STATUS_LABEL[aluno.status] },
  ];

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="px-3 py-2.5 flex items-center justify-between border-b border-border">
        <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Sparkles className="h-4 w-4 text-rose-500" /> Próximas informações
        </div>
      </div>
      <ul className="divide-y divide-border">
        {linhas.map((l) => {
          const Icon = l.icon;
          return (
            <li key={l.label} className="px-3 py-2 flex items-start justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-[12px] text-muted-foreground shrink-0">
                <Icon className="h-3.5 w-3.5" />
                {l.label}
              </span>
              <span className="inline-flex items-center gap-2">
                {l.status && (
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${BADGE[l.status.tone]}`}>
                    {l.status.label}
                  </span>
                )}
                <span className={`text-[12px] font-medium text-right leading-snug ${TONE[l.tone ?? "default"]}`}>
                  {l.value}
                </span>
                {l.previewTipo && (
                  <button
                    type="button"
                    onClick={() => void abrirPreview(l.previewTipo!)}
                    title="Ver prévia da mensagem"
                    className="inline-flex items-center justify-center h-5 w-5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </button>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="px-3 py-2 border-t border-border bg-muted/30">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Ação sugerida</div>
        <div className="text-[12px] text-foreground font-medium leading-snug">{sugerida}</div>
      </div>
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Prévia da mensagem</DialogTitle>
            <DialogDescription>
              {previewTipo ? `Tipo: ${previewTipo}` : ""}
              {" — "}Conteúdo que será enviado por WhatsApp.
            </DialogDescription>
          </DialogHeader>
          {previewLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
              <Loader2 className="h-4 w-4 animate-spin" /> Gerando prévia…
            </div>
          ) : previewErro && !previewMsg ? (
            <div className="text-sm text-destructive">{previewErro}</div>
          ) : (
            <pre className="whitespace-pre-wrap text-sm bg-muted/50 rounded-md p-3 max-h-[60vh] overflow-auto font-sans">
              {previewMsg || "Sem conteúdo."}
            </pre>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}