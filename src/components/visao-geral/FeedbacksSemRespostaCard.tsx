import { useEffect, useState, useTransition } from "react";
import { Link } from "@tanstack/react-router";
import { MessageSquare, Send, MessageCircle, ExternalLink, Loader2, ChevronDown, ChevronUp, Check, Clock, History, FileCheck2, Users, Inbox } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import {
  listFeedbacksSemResposta,
  listFeedbacksAguardandoDevolutiva,
  listFeedbacksAguardandoEnvio,
  agendarLembreteFeedback,
  enviarResumoFeedbacksPendentesGrupo,
  enviarResumoDevolutivasPendentesGrupo,
  enviarAguardandoEnvioParaGrupo,
  marcarJobsEnviadosManualmente,
  marcarDevolutivaEnviadaManualmente,
  enviarDevolutivaDireto,
  listHistoricoFeedbacksAluno,
  type FeedbackPendente,
  type FeedbackAguardandoDevolutiva,
  type FeedbackAguardandoEnvio,
  type HistoricoEnvioFeedback,
} from "@/server/feedback-lembretes.functions";

import { dispararJobsAgora } from "@/server/motor.functions";
import { previewMensagemJob } from "@/server/motor-preview.functions";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

const TIPO_LABEL: Record<string, string> = {
  feedback_quinzenal: "Quinzenal",
  feedback_mensal: "Mensal",
  feedback_quinzenal_link: "Check-in Quinzenal",
  feedback_mensal_link: "Link Mensal",
  feedback_link_lembrete: "Lembrete",
  followup_d7: "Follow-up D7",
  followup_d21: "Follow-up D21",
  pos_entrega_d1: "Pós-entrega D+1",
};
const MOD_LABEL: Record<string, string> = {
  mpteam: "MPTEAM", mp_elite: "MP Elite", mp_presencial: "MP Presencial",
};

function fmtData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}
function fmtRelativo(iso: string | null): string {
  if (!iso) return "Nunca";
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (dias === 0) return "Hoje";
  if (dias === 1) return "Ontem";
  return `há ${dias}d`;
}
function whatsappHref(phone: string): string {
  return `https://wa.me/${(phone || "").replace(/\D/g, "")}`;
}
function whatsappHrefComTexto(phone: string, texto: string): string {
  const tel = (phone || "").replace(/\D/g, "");
  return `https://wa.me/${tel}?text=${encodeURIComponent(texto)}`;
}
function abrirJanelaPreparandoWhatsApp(): Window | null {
  const opened = window.open("", "_blank");
  if (!opened) return null;
  opened.opener = null;
  try {
    opened.document.write(`<!doctype html><html><head><title>Preparando WhatsApp</title><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#f8fafc;color:#0f172a}.box{text-align:center;padding:24px}.dot{width:36px;height:36px;border:4px solid #d1fae5;border-top-color:#059669;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 16px}@keyframes spin{to{transform:rotate(360deg)}}</style></head><body><div class="box"><div class="dot"></div><strong>Preparando WhatsApp…</strong><p>A conversa será aberta em instantes.</p></div></body></html>`);
    opened.document.close();
  } catch {
    // Se o navegador bloquear escrita no popup, ainda tentamos redirecionar a aba aberta.
  }
  return opened;
}
function fecharJanelaPreparando(opened: Window | null) {
  try {
    if (opened && !opened.closed) opened.close();
  } catch {
    // Alguns navegadores não permitem fechar; nesse caso apenas seguimos com o toast.
  }
}
function abrirUrlExterna(url: string, janelaExistente?: Window | null) {
  if (janelaExistente && !janelaExistente.closed) {
    janelaExistente.location.href = url;
    return;
  }
  const novaJanela = window.open(url, "_blank");
  if (novaJanela) {
    novaJanela.opener = null;
    return;
  }
  window.location.href = url;
}

function mensagemIndisponivel(tipo: "mensagem" | "devolutiva", erro?: string | null) {
  const label = tipo === "devolutiva" ? "Devolutiva" : "Mensagem";
  toast.error(erro ? `${label} não carregou: ${erro}` : `${label} ainda não carregou. Aguarde alguns segundos e tente de novo.`);
}

export function FeedbacksSemRespostaCard() {
  const { isAdmin } = useAuth();
  const [itens, setItens] = useState<FeedbackPendente[]>([]);
  const [devolutivas, setDevolutivas] = useState<FeedbackAguardandoDevolutiva[]>([]);
  const [aguardando, setAguardando] = useState<FeedbackAguardandoEnvio[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyEnviarTodos, setBusyEnviarTodos] = useState(false);
  const [busyGrupo, setBusyGrupo] = useState(false);
  const [busyGrupoDev, setBusyGrupoDev] = useState(false);
  const [, startTransition] = useTransition();

  const listFn = useServerFn(listFeedbacksSemResposta);
  const listDevFn = useServerFn(listFeedbacksAguardandoDevolutiva);
  const listEnvioFn = useServerFn(listFeedbacksAguardandoEnvio);
  const agendarFn = useServerFn(agendarLembreteFeedback);
  const dispararFn = useServerFn(dispararJobsAgora);
  const enviarGrupoFn = useServerFn(enviarResumoFeedbacksPendentesGrupo);
  const enviarGrupoDevFn = useServerFn(enviarResumoDevolutivasPendentesGrupo);
  const enviarAguardandoGrupoFn = useServerFn(enviarAguardandoEnvioParaGrupo);
  const marcarManualFn = useServerFn(marcarJobsEnviadosManualmente);
  const marcarDevManualFn = useServerFn(marcarDevolutivaEnviadaManualmente);
  const previewFn = useServerFn(previewMensagemJob);
  const enviarDevDiretoFn = useServerFn(enviarDevolutivaDireto);
  const [busyPreviewId, setBusyPreviewId] = useState<string | null>(null);
  const [busyDevPreviewId, setBusyDevPreviewId] = useState<string | null>(null);
  const [busyDevDiretoId, setBusyDevDiretoId] = useState<string | null>(null);

  // Histórico de envios por aluno (o que foi enviado e quando)
  const historicoFn = useServerFn(listHistoricoFeedbacksAluno);
  const [histAluno, setHistAluno] = useState<string | null>(null);
  const [histLoading, setHistLoading] = useState(false);
  const [histItens, setHistItens] = useState<HistoricoEnvioFeedback[]>([]);

  function alternarHistorico(alunoId: string) {
    if (histAluno === alunoId) {
      setHistAluno(null);
      return;
    }
    setHistAluno(alunoId);
    setHistItens([]);
    setHistLoading(true);
    historicoFn({ data: { alunoId } })
      .then((r) => setHistItens(r.itens))
      .catch(() => toast.error("Não foi possível carregar o histórico"))
      .finally(() => setHistLoading(false));
  }



  function abrirWhatsAppComMensagem(j: FeedbackAguardandoEnvio) {
    if (!j.whatsapp) {
      toast.error("Aluno sem WhatsApp cadastrado");
      return;
    }
    if (!j.mensagem_pronta?.trim()) {
      const janelaWhatsApp = abrirJanelaPreparandoWhatsApp();
      toast("Preparando mensagem para o WhatsApp...");
      setBusyPreviewId(j.job_id);
      previewFn({ data: { alunoId: j.aluno_id, tipo: j.tipo, formularioId: j.formulario_id } })
        .then((r) => {
          if (r.mensagem) {
            setAguardando((curr) => curr.map((x) => x.job_id === j.job_id ? { ...x, mensagem_pronta: r.mensagem, mensagem_erro: null } : x));
            abrirUrlExterna(whatsappHrefComTexto(j.whatsapp, r.mensagem), janelaWhatsApp);
            marcarManualFn({ data: { ids: [j.job_id] } })
              .then(() => setAguardando((curr) => curr.filter((x) => x.job_id !== j.job_id)))
              .catch((err) => console.error("Falha ao marcar job como enviado manualmente", err));
          } else {
            fecharJanelaPreparando(janelaWhatsApp);
            setAguardando((curr) => curr.map((x) => x.job_id === j.job_id ? { ...x, mensagem_erro: r.error || "Mensagem vazia" } : x));
            mensagemIndisponivel("mensagem", r.error || "Mensagem vazia");
          }
        })
        .catch((e) => {
          fecharJanelaPreparando(janelaWhatsApp);
          const msg = e instanceof Error ? e.message : "Falha ao carregar mensagem";
          setAguardando((curr) => curr.map((x) => x.job_id === j.job_id ? { ...x, mensagem_erro: msg } : x));
          mensagemIndisponivel("mensagem", msg);
        })
        .finally(() => setBusyPreviewId(null));
      return;
    }

    const url = whatsappHrefComTexto(j.whatsapp, j.mensagem_pronta);
    abrirUrlExterna(url);

    // Marca como enviado manualmente em background (não bloqueia o gesto).
    marcarManualFn({ data: { ids: [j.job_id] } })
      .then(() => setAguardando((curr) => curr.filter((x) => x.job_id !== j.job_id)))
      .catch((err) => console.error("Falha ao marcar job como enviado manualmente", err));
  }

  function abrirDevolutivaWhatsApp(d: FeedbackAguardandoDevolutiva) {
    if (!d.whatsapp) {
      toast.error("Aluno sem WhatsApp cadastrado");
      return;
    }
    if (!d.mensagem_pronta?.trim()) {
      const janelaWhatsApp = abrirJanelaPreparandoWhatsApp();
      toast("Gerando devolutiva para o WhatsApp...");
      setBusyDevPreviewId(d.formulario_id);
      const tipoResp = d.tipo === "feedback_mensal" ? "feedback_mensal_resposta" : "feedback_quinzenal_resposta";
      previewFn({ data: { alunoId: d.aluno_id, tipo: tipoResp, formularioId: d.formulario_id } })
        .then((r) => {
          if (r.mensagem) {
            setDevolutivas((curr) => curr.map((x) => x.formulario_id === d.formulario_id ? { ...x, mensagem_pronta: r.mensagem, mensagem_erro: null } : x));
            abrirUrlExterna(whatsappHrefComTexto(d.whatsapp, r.mensagem), janelaWhatsApp);
            marcarDevManualFn({ data: { formularioId: d.formulario_id, alunoId: d.aluno_id, tipo: d.tipo, mensagem: r.mensagem } })
              .then(() => setDevolutivas((curr) => curr.filter((x) => x.formulario_id !== d.formulario_id)))
              .catch((err) => console.error("Falha ao marcar devolutiva como enviada manualmente", err));
          } else {
            fecharJanelaPreparando(janelaWhatsApp);
            setDevolutivas((curr) => curr.map((x) => x.formulario_id === d.formulario_id ? { ...x, mensagem_erro: r.error || "Mensagem vazia" } : x));
            mensagemIndisponivel("devolutiva", r.error || "Mensagem vazia");
          }
        })
        .catch((e) => {
          fecharJanelaPreparando(janelaWhatsApp);
          const msg = e instanceof Error ? e.message : "Falha ao carregar devolutiva";
          setDevolutivas((curr) => curr.map((x) => x.formulario_id === d.formulario_id ? { ...x, mensagem_erro: msg } : x));
          mensagemIndisponivel("devolutiva", msg);
        })
        .finally(() => setBusyDevPreviewId(null));
      return;
    }

    const url = whatsappHrefComTexto(d.whatsapp, d.mensagem_pronta);
    abrirUrlExterna(url);

    marcarDevManualFn({ data: { formularioId: d.formulario_id, alunoId: d.aluno_id, tipo: d.tipo, mensagem: d.mensagem_pronta } })
      .then(() => setDevolutivas((curr) => curr.filter((x) => x.formulario_id !== d.formulario_id)))
      .catch((err) => console.error("Falha ao marcar devolutiva como enviada manualmente", err));
  }

  async function enviarDevolutivaZapi(d: FeedbackAguardandoDevolutiva) {
    if (!d.whatsapp) { toast.error("Aluno sem WhatsApp cadastrado"); return; }
    setBusyDevDiretoId(d.formulario_id);
    try {
      const r = await enviarDevDiretoFn({ data: { formularioId: d.formulario_id, alunoId: d.aluno_id, tipo: d.tipo } });
      if (r.ok) {
        toast.success(`Devolutiva enviada para ${d.aluno_nome}`);
        setDevolutivas((curr) => curr.filter((x) => x.formulario_id !== d.formulario_id));
      } else {
        toast.error(r.error || "Falha ao enviar devolutiva");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar devolutiva");
    } finally {
      setBusyDevDiretoId(null);
    }
  }

  async function carregar() {
    setLoading(true);
    try {
      const [r, d, e] = await Promise.all([listFn(), listDevFn(), listEnvioFn()]);
      setItens(r.itens);
      setDevolutivas(d.itens);
      setAguardando(e.itens);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void carregar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function reenviar(item: FeedbackPendente) {
    setBusyId(item.formulario_id);
    try {
      const r = await agendarFn({ data: { formularioId: item.formulario_id } });
      if (!r.ok || !r.jobId) {
        toast.error(r.error || "Falha ao agendar lembrete");
        return;
      }
      const d = await dispararFn({ data: { ids: [r.jobId], intervaloMs: 0 } });
      const det = d.detalhes?.[0];
      if (det?.ok) {
        toast.success("Lembrete enviado");
        startTransition(() => { void carregar(); });
      } else {
        toast.error(det?.error || "Falha ao enviar lembrete");
      }
    } finally { setBusyId(null); }
  }

  async function enviarResumoGrupo() {
    if (itens.length === 0) return;
    setBusyGrupo(true);
    try {
      const r = await enviarGrupoFn();
      if (r.ok) {
        toast.success(`Resumo enviado ao grupo (${r.total} alunos)`);
        setItens([]);
      } else toast.error(r.error || "Falha ao enviar ao grupo");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar ao grupo");
    } finally {
      setBusyGrupo(false);
    }
  }

  async function enviarResumoGrupoDev() {
    if (devolutivas.length === 0) return;
    setBusyGrupoDev(true);
    try {
      const r = await enviarGrupoDevFn();
      if (r.ok) {
        toast.success(`Devolutivas enviadas ao grupo (${r.total} alunos)`);
        setDevolutivas([]);
      } else toast.error(r.error || "Falha ao enviar ao grupo");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar ao grupo");
    } finally {
      setBusyGrupoDev(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando feedbacks pendentes...
        </div>
      </div>
    );
  }

  if (itens.length === 0 && devolutivas.length === 0 && aguardando.length === 0) return null;
  const total = itens.length + devolutivas.length + aguardando.length;

  async function dispararTodos() {
    if (aguardando.length === 0) return;
    setBusyEnviarTodos(true);
    try {
      const ids = aguardando.map((a) => a.job_id);
      const r = await enviarAguardandoGrupoFn({ data: { ids } });
      if (r.ok) toast.success(`Enviados ao grupo: ${r.enviados}`);
      else if (r.enviados > 0) toast.warning(`Enviados ao grupo: ${r.enviados} · Falhas: ${r.falhas}`);
      else toast.error(r.error || "Falha ao enviar ao grupo");
      startTransition(() => { void carregar(); });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao disparar");
    } finally { setBusyEnviarTodos(false); }
  }

  return (
    <div className="rounded-lg border-2 border-amber-300/60 bg-amber-50/40 dark:bg-amber-500/5 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-amber-100/50 dark:hover:bg-amber-500/10 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-sm sm:text-base">Feedbacks pendentes</div>
            <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
              <span>Total: <strong className="text-amber-700">{total}</strong></span>
              {aguardando.length > 0 && (
                <span className="inline-flex items-center gap-1 text-blue-700">
                  <Inbox className="h-3 w-3" /> {aguardando.length} aguardando envio
                </span>
              )}
              {itens.length > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {itens.length} sem resposta (3d+)
                </span>
              )}
              {devolutivas.length > 0 && (
                <span className="inline-flex items-center gap-1 text-emerald-700">
                  <FileCheck2 className="h-3 w-3" /> {devolutivas.length} aguardando devolutiva
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden sm:inline text-xs text-muted-foreground">{open ? "Fechar" : "Ver alunos"}</span>
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-amber-300/50 bg-card divide-y divide-border max-h-96 overflow-y-auto">
          {aguardando.length > 0 && (
            <div className="px-3 py-2 bg-blue-50/70 flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">
                Aguardando envio
              </span>
              <button
                onClick={dispararTodos}
                disabled={busyEnviarTodos || !isAdmin}
                title={isAdmin ? "Enviar todos ao grupo de Feedbacks & Follow-ups" : "Apenas administradores"}
                className="inline-flex items-center gap-1 rounded-md bg-blue-600 text-white px-2.5 py-1 text-[11px] font-medium hover:opacity-90 disabled:opacity-50"
              >
                {busyEnviarTodos ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Users className="h-3.5 w-3.5" />}
                Enviar todos ao grupo
              </button>
            </div>
          )}
          {aguardando.map((j) => (
            <div key={`env-${j.job_id}`} className="p-3 sm:p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => abrirWhatsAppComMensagem(j)}
                      disabled={busyPreviewId === j.job_id}
                      title="Abrir WhatsApp com a mensagem programada"
                      className="font-semibold text-sm hover:underline truncate inline-flex items-center gap-1 text-emerald-700 disabled:opacity-50"
                    >
                      {busyPreviewId === j.job_id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <MessageCircle className="h-3.5 w-3.5" />}
                      {j.aluno_nome}
                    </button>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                      {TIPO_LABEL[j.tipo] ?? j.tipo}
                    </span>
                    {j.modalidade && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {MOD_LABEL[j.modalidade] ?? j.modalidade}
                      </span>
                    )}
                    {j.atrasado && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-medium">Atrasado</span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                    <span>Agendado: <strong className="text-foreground">{new Date(j.agendado_para).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</strong></span>
                    <span>Tel: {j.whatsapp || "—"}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => abrirWhatsAppComMensagem(j)}
                    disabled={busyPreviewId === j.job_id || !j.whatsapp}
                    title="Abrir WhatsApp com a mensagem programada"
                    className="inline-flex items-center gap-1 rounded-md bg-emerald-600 text-white px-2.5 py-1.5 text-xs font-medium hover:opacity-90 disabled:opacity-50"
                  >
                    {busyPreviewId === j.job_id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <MessageCircle className="h-3.5 w-3.5" />}
                    <span className="hidden sm:inline">WhatsApp</span>
                  </button>
                  <Link to="/alunos/$id" params={{ id: j.aluno_id }} title="Abrir ficha do aluno" className="inline-flex items-center justify-center h-7 w-7 rounded-md border border-border hover:bg-muted">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
          {devolutivas.length > 0 && (
            <div className="px-3 py-2 bg-emerald-50/60 flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                Respondidos aguardando devolutiva
              </span>
              <button
                onClick={enviarResumoGrupoDev}
                disabled={busyGrupoDev || !isAdmin}
                title={isAdmin ? "Enviar devolutivas pendentes ao grupo configurado" : "Apenas administradores"}
                className="inline-flex items-center gap-1 rounded-md bg-emerald-600 text-white px-2.5 py-1 text-[11px] font-medium hover:opacity-90 disabled:opacity-50"
              >
                {busyGrupoDev ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Users className="h-3.5 w-3.5" />}
                Enviar
              </button>
            </div>
          )}
          {devolutivas.map((d) => (
            <div key={`dev-${d.formulario_id}`} className="p-3 sm:p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      to="/alunos/$id"
                      params={{ id: d.aluno_id }}
                      className="font-semibold text-sm hover:underline truncate"
                    >
                      {d.aluno_nome}
                    </Link>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                      {TIPO_LABEL[d.tipo] ?? d.tipo}
                    </span>
                    {d.modalidade && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {MOD_LABEL[d.modalidade] ?? d.modalidade}
                      </span>
                    )}
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium inline-flex items-center gap-1">
                      <FileCheck2 className="h-3 w-3" /> Respondeu {fmtRelativo(d.respondido_em)}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                    <span>Respondido em: <strong className="text-foreground">{fmtData(d.respondido_em)}</strong></span>
                    <span>Tel: {d.whatsapp || "—"}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => enviarDevolutivaZapi(d)}
                    disabled={busyDevDiretoId === d.formulario_id || !d.whatsapp}
                    title="Enviar devolutiva direto no WhatsApp do aluno via Z-API"
                    className="inline-flex items-center gap-1 rounded-md bg-emerald-600 text-white px-2.5 py-1.5 text-xs font-medium hover:opacity-90 disabled:opacity-50"
                  >
                    {busyDevDiretoId === d.formulario_id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Send className="h-3.5 w-3.5" />}
                    <span className="hidden sm:inline">Enviar ao aluno</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => abrirDevolutivaWhatsApp(d)}
                    disabled={busyDevPreviewId === d.formulario_id || !d.whatsapp}
                    title="Abrir WhatsApp manualmente com a devolutiva"
                    className="inline-flex items-center justify-center h-7 w-7 rounded-md border border-border hover:bg-muted text-emerald-600 disabled:opacity-50"
                  >
                    {busyDevPreviewId === d.formulario_id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <MessageCircle className="h-3.5 w-3.5" />}
                  </button>
                  <Link
                    to="/alunos/$id"
                    params={{ id: d.aluno_id }}
                    title="Abrir ficha do aluno"
                    className="inline-flex items-center justify-center h-7 w-7 rounded-md border border-border hover:bg-muted"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
          {itens.length > 0 && (
            <div className="px-3 py-2 bg-amber-50/80 flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                Sem resposta há 3 dias ou mais
              </span>
              <button
                onClick={enviarResumoGrupo}
                disabled={busyGrupo || !isAdmin}
                title={isAdmin ? "Enviar resumo de pendentes ao grupo configurado" : "Apenas administradores"}
                className="inline-flex items-center gap-1 rounded-md bg-amber-600 text-white px-2.5 py-1 text-[11px] font-medium hover:opacity-90 disabled:opacity-50"
              >
                {busyGrupo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Users className="h-3.5 w-3.5" />}
                Enviar
              </button>
            </div>
          )}
          {itens.map((it) => {
            const lembreteEnviado = !!it.lembrete_enviado_em;
            return (
              <div key={it.formulario_id} className="p-3 sm:p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        to="/alunos/$id"
                        params={{ id: it.aluno_id }}
                        className="font-semibold text-sm hover:underline truncate"
                      >
                        {it.aluno_nome}
                      </Link>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                        {TIPO_LABEL[it.tipo] ?? it.tipo}
                      </span>
                      {it.modalidade && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          {MOD_LABEL[it.modalidade] ?? it.modalidade}
                        </span>
                      )}
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">
                        {it.dias_sem_resposta} {it.dias_sem_resposta === 1 ? "dia" : "dias"} sem resposta
                      </span>
                      {lembreteEnviado && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 inline-flex items-center gap-1">
                          <Check className="h-3 w-3" /> Lembrete {fmtRelativo(it.lembrete_enviado_em)}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                      <span>Enviado: <strong className="text-foreground">{fmtData(it.enviado_em)}</strong></span>
                      <span>Tel: {it.whatsapp || "—"}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => reenviar(it)}
                      disabled={busyId === it.formulario_id || !it.whatsapp}
                      title={lembreteEnviado ? "Reenviar lembrete" : "Enviar lembrete"}
                      className="inline-flex items-center gap-1 rounded-md bg-primary text-primary-foreground px-2.5 py-1.5 text-xs font-medium hover:opacity-90 disabled:opacity-50"
                    >
                      {busyId === it.formulario_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                      <span className="hidden sm:inline">{lembreteEnviado ? "Reenviar" : "Lembrete"}</span>
                    </button>
                    <button
                      onClick={() => alternarHistorico(it.aluno_id)}
                      title="Ver histórico de envios"
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
                    >
                      <History className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Histórico</span>
                    </button>

                    <a
                      href={whatsappHref(it.whatsapp)}
                      target="_blank"
                      rel="noreferrer"
                      title="Abrir WhatsApp"
                      className="inline-flex items-center justify-center h-7 w-7 rounded-md border border-border hover:bg-muted text-emerald-600"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                    </a>
                    <Link
                      to="/alunos/$id"
                      params={{ id: it.aluno_id }}
                      title="Abrir ficha do aluno"
                      className="inline-flex items-center justify-center h-7 w-7 rounded-md border border-border hover:bg-muted"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
                {histAluno === it.aluno_id && (
                  <div className="mt-3 rounded-lg border border-border bg-muted/40 p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      Histórico de envios — {it.aluno_nome}
                    </div>
                    {histLoading ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando…
                      </div>
                    ) : histItens.length === 0 ? (
                      <div className="text-xs text-muted-foreground">Nenhum envio registrado.</div>
                    ) : (
                      <ul className="space-y-1.5">
                        {histItens.map((h) => (
                          <li key={h.id} className="flex items-center justify-between gap-2 text-xs">
                            <span className="flex items-center gap-2 min-w-0">
                              <span className="text-muted-foreground shrink-0">{fmtData(h.enviado_em)}</span>
                              <span className="font-medium truncate">{TIPO_LABEL[h.tipo] ?? h.tipo}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                                {h.origem === "formulario" ? "Formulário" : "Mensagem"}
                              </span>
                            </span>
                            <span className="shrink-0">
                              {h.respondido_em ? (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                                  Respondido {fmtData(h.respondido_em)}
                                </span>
                              ) : (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                                  {h.status === "erro" ? "Erro no envio" : "Sem resposta"}
                                </span>
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>

            );
          })}
        </div>
      )}
    </div>
  );
}