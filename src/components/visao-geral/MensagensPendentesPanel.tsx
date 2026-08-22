import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AlertTriangle, CalendarClock, Check, Loader2, MessageCircle, RefreshCw,
  Filter, History, ChevronDown, ChevronUp,
} from "lucide-react";
import {
  listPendenciasComunicacao,
  registrarEnvioManualPendencia,
  listHistoricoPendencias,
  agendarCiclosAlunosAtivos,
  type PendenciasResultado,
  type PendenciaItem,
} from "@/server/pendencias.functions";
import { previewMensagemJob } from "@/server/motor-preview.functions";

const TIPO_LABEL: Record<string, string> = {
  feedback_mensal: "Feedback mensal",
  feedback_quinzenal: "Check-in quinzenal",
};
const UNIDADE_LABEL: Record<string, string> = {
  mpteam: "MP Team",
  mp_elite: "MP Elite",
  mp_presencial: "MP Presencial",
  sem_unidade: "Sem unidade",
};
const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  enviado_manual: "Enviado manualmente",
  resolvido: "Resolvido",
};

function fmtData(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}
function waHref(phone: string, texto?: string): string {
  const tel = (phone || "").replace(/\D/g, "");
  const base = `https://wa.me/${tel.length <= 11 ? `55${tel}` : tel}`;
  return texto ? `${base}?text=${encodeURIComponent(texto)}` : base;
}
function abrirJanela(): Window | null {
  const w = window.open("", "_blank");
  if (w) w.opener = null;
  return w;
}
function irPara(url: string, janela: Window | null) {
  if (janela && !janela.closed) { janela.location.href = url; return; }
  const nova = window.open(url, "_blank");
  if (nova) { nova.opener = null; return; }
  window.location.href = url;
}

export function MensagensPendentesPanel() {
  const [dados, setDados] = useState<PendenciasResultado | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [sincronizando, setSincronizando] = useState(false);
  const [mostrarHistorico, setMostrarHistorico] = useState(false);
  const [historico, setHistorico] = useState<any[]>([]);

  const [fUnidade, setFUnidade] = useState("");
  const [fTipo, setFTipo] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fDe, setFDe] = useState("");
  const [fAte, setFAte] = useState("");
  const [fResp, setFResp] = useState("");

  const listFn = useServerFn(listPendenciasComunicacao);
  const registrarFn = useServerFn(registrarEnvioManualPendencia);
  const historicoFn = useServerFn(listHistoricoPendencias);
  const agendarFn = useServerFn(agendarCiclosAlunosAtivos);
  const previewFn = useServerFn(previewMensagemJob);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await listFn({
        data: {
          unidade: fUnidade || null,
          tipo: (fTipo || null) as any,
          status: (fStatus || null) as any,
          de: fDe || null,
          ate: fAte || null,
          responsavel: fResp || null,
        },
      });
      setDados(r as PendenciasResultado);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao carregar pendências");
    } finally {
      setLoading(false);
    }
  }, [listFn, fUnidade, fTipo, fStatus, fDe, fAte, fResp]);

  useEffect(() => { void carregar(); }, [carregar]);

  const itens = dados?.itens ?? [];
  const ind = dados?.indicadores;

  const criticos = useMemo(
    () => itens.filter((i) => i.status_atendimento === "pendente" && i.dias_atraso >= 7).length,
    [itens],
  );

  async function enviarWhatsApp(it: PendenciaItem) {
    const janela = abrirJanela();
    setBusy(it.key);
    let texto = "";
    try {
      const tipoJob = it.tipo === "feedback_mensal" ? "feedback_mensal_link" : "feedback_quinzenal_link";
      const p: any = await previewFn({ data: { alunoId: it.aluno_id, tipo: tipoJob } });
      texto = p?.mensagem ?? "";
    } catch {
      texto = "";
    }
    irPara(waHref(it.whatsapp, texto || undefined), janela);
    setBusy(null);
  }

  async function registrar(it: PendenciaItem, acao: "enviado_manual" | "resolvido") {
    setBusy(it.key);
    try {
      const r: any = await registrarFn({
        data: {
          alunoId: it.aluno_id,
          tipo: it.tipo,
          dataPrevista: it.data_prevista,
          jobId: it.job_id,
          acao,
        },
      });
      if (!r?.ok) throw new Error(r?.error ?? "Falha ao registrar");
      toast.success(acao === "resolvido" ? "Marcado como resolvido" : "Envio manual registrado");
      await carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao registrar");
    } finally {
      setBusy(null);
    }
  }

  async function sincronizarAgenda() {
    setSincronizando(true);
    try {
      const r: any = await agendarFn({ data: {} } as any);
      if (!r?.ok) throw new Error(r?.error ?? "Falha ao atualizar agenda");
      toast.success(`Agenda atualizada: ${r.quinzenais ?? 0} check-ins e ${r.mensais ?? 0} feedbacks agendados`);
      await carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao atualizar agenda");
    } finally {
      setSincronizando(false);
    }
  }

  async function alternarHistorico() {
    const novo = !mostrarHistorico;
    setMostrarHistorico(novo);
    if (novo && historico.length === 0) {
      try {
        const r: any = await historicoFn({ data: {} } as any);
        setHistorico(r?.itens ?? []);
      } catch {
        toast.error("Falha ao carregar histórico");
      }
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card">
      <header className="flex flex-wrap items-center gap-3 justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <h2 className="text-sm font-semibold">Mensagens Pendentes</h2>
          <span className="text-xs text-muted-foreground">
            comunicações automáticas que não saíram
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={sincronizarAgenda}
            disabled={sincronizando}
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded border border-border hover:bg-muted disabled:opacity-60"
          >
            {sincronizando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CalendarClock className="w-3.5 h-3.5" />}
            Atualizar agenda
          </button>
          <button
            onClick={() => void carregar()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded border border-border hover:bg-muted disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </button>
        </div>
      </header>

      {/* Indicadores */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4">
        <Indicador titulo="Total pendente" valor={ind?.total ?? 0} />
        <Indicador titulo="Feedback mensal" valor={ind?.mensais ?? 0} />
        <Indicador titulo="Check-in quinzenal" valor={ind?.quinzenais ?? 0} />
        <Indicador titulo="Enviados manualmente hoje" valor={ind?.enviosManuaisHoje ?? 0} />
      </div>

      {criticos > 0 && (
        <div className="mx-4 mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {criticos} aluno(s) com atraso igual ou superior a 7 dias.
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 px-4 pb-3 text-xs">
        <Filter className="w-3.5 h-3.5 text-muted-foreground" />
        <select value={fUnidade} onChange={(e) => setFUnidade(e.target.value)} className="border border-border rounded px-2 py-1 bg-background">
          <option value="">Todas as unidades</option>
          <option value="mpteam">MP Team</option>
          <option value="mp_elite">MP Elite</option>
          <option value="mp_presencial">MP Presencial</option>
        </select>
        <select value={fTipo} onChange={(e) => setFTipo(e.target.value)} className="border border-border rounded px-2 py-1 bg-background">
          <option value="">Todos os tipos</option>
          <option value="feedback_mensal">Feedback mensal</option>
          <option value="feedback_quinzenal">Check-in quinzenal</option>
        </select>
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="border border-border rounded px-2 py-1 bg-background">
          <option value="">Todos os status</option>
          <option value="pendente">Pendente</option>
          <option value="enviado_manual">Enviado manualmente</option>
          <option value="resolvido">Resolvido</option>
        </select>
        <select value={fResp} onChange={(e) => setFResp(e.target.value)} className="border border-border rounded px-2 py-1 bg-background">
          <option value="">Todos os responsáveis</option>
          {(dados?.responsaveis ?? []).map((r) => (
            <option key={r.id} value={r.id}>{r.nome}</option>
          ))}
        </select>
        <input type="date" value={fDe} onChange={(e) => setFDe(e.target.value)} className="border border-border rounded px-2 py-1 bg-background" />
        <input type="date" value={fAte} onChange={(e) => setFAte(e.target.value)} className="border border-border rounded px-2 py-1 bg-background" />
      </div>

      {/* Lista */}
      <div className="overflow-x-auto">
        {loading ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Carregando…
          </div>
        ) : itens.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Nenhuma pendência de comunicação. Todos os alunos ativos estão em dia.
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Aluno</th>
                <th className="text-left px-3 py-2 font-medium">Unidade / Plano</th>
                <th className="text-left px-3 py-2 font-medium">Tipo</th>
                <th className="text-left px-3 py-2 font-medium">Prevista</th>
                <th className="text-left px-3 py-2 font-medium">Atraso</th>
                <th className="text-left px-3 py-2 font-medium">Motivo</th>
                <th className="text-left px-3 py-2 font-medium">Status</th>
                <th className="text-right px-3 py-2 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((it) => (
                <tr key={it.key} className="border-t border-border align-top">
                  <td className="px-3 py-2">
                    <Link to="/alunos/$id" params={{ id: it.aluno_id }} className="font-medium hover:underline">
                      {it.aluno_nome}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {UNIDADE_LABEL[it.unidade ?? "sem_unidade"] ?? it.unidade}
                    {it.plano ? <div className="text-[11px]">{it.plano}</div> : null}
                  </td>
                  <td className="px-3 py-2">{TIPO_LABEL[it.tipo]}</td>
                  <td className="px-3 py-2">{fmtData(it.data_prevista)}</td>
                  <td className="px-3 py-2">
                    <span className={it.dias_atraso >= 7 ? "text-red-600 font-medium" : "text-amber-700"}>
                      {it.dias_atraso}d
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground max-w-[220px] truncate" title={it.motivo_erro ?? ""}>
                    {it.motivo_erro ?? "Não executado"}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] ${
                      it.status_atendimento === "pendente" ? "bg-amber-50 text-amber-700"
                      : it.status_atendimento === "resolvido" ? "bg-slate-100 text-slate-700"
                      : "bg-emerald-50 text-emerald-700"}`}
                    >
                      {STATUS_LABEL[it.status_atendimento]}
                    </span>
                    {it.responsavel_nome && (
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {it.responsavel_nome} · {fmtData(it.acao_em)}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1.5">
                      <button
                        onClick={() => void enviarWhatsApp(it)}
                        disabled={busy === it.key}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                      >
                        {busy === it.key ? <Loader2 className="w-3 h-3 animate-spin" /> : <MessageCircle className="w-3 h-3" />}
                        WhatsApp
                      </button>
                      {it.status_atendimento === "pendente" && (
                        <>
                          <button
                            onClick={() => void registrar(it, "enviado_manual")}
                            disabled={busy === it.key}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border hover:bg-muted disabled:opacity-60"
                          >
                            <Check className="w-3 h-3" /> Enviei
                          </button>
                          <button
                            onClick={() => void registrar(it, "resolvido")}
                            disabled={busy === it.key}
                            className="px-2 py-1 rounded border border-border hover:bg-muted disabled:opacity-60"
                          >
                            Resolver
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Histórico */}
      <div className="border-t border-border">
        <button
          onClick={() => void alternarHistorico()}
          className="w-full flex items-center justify-between px-4 py-2 text-xs text-muted-foreground hover:bg-muted/50"
        >
          <span className="inline-flex items-center gap-1.5"><History className="w-3.5 h-3.5" /> Histórico de ações manuais</span>
          {mostrarHistorico ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        {mostrarHistorico && (
          <div className="px-4 pb-3 space-y-1 max-h-64 overflow-y-auto">
            {historico.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">Nenhum registro ainda.</p>
            ) : historico.map((h) => (
              <div key={h.id} className="text-xs flex flex-wrap gap-2 border-b border-border/60 py-1.5">
                <span className="font-medium">{h.aluno_nome}</span>
                <span className="text-muted-foreground">{TIPO_LABEL[h.tipo_mensagem] ?? h.tipo_mensagem}</span>
                <span className="text-muted-foreground">· {STATUS_LABEL[h.acao] ?? h.acao}</span>
                <span className="text-muted-foreground">· {h.usuario_nome ?? "—"}</span>
                <span className="text-muted-foreground ml-auto">{fmtData(h.criado_em)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function Indicador({ titulo, valor }: { titulo: string; valor: number }) {
  return (
    <div className="rounded border border-border p-3">
      <div className="text-[11px] text-muted-foreground">{titulo}</div>
      <div className="text-xl font-semibold mt-0.5">{valor}</div>
    </div>
  );
}
