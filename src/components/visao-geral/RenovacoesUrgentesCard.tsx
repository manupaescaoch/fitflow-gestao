import { useEffect, useState, useTransition } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Clock, Send, Check, MessageCircle, ExternalLink, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import {
  listRenovacoesUrgentes,
  enviarCobrancaRenovacao,
  marcarRenovacaoResolvida,
  type RenovacaoUrgente,
} from "@/server/renovacoes.functions";
import { toast } from "sonner";

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
  return `${dias}d atrás`;
}
function whatsappHref(phone: string): string {
  const digits = (phone || "").replace(/\D/g, "");
  return `https://wa.me/${digits}`;
}

export function RenovacoesUrgentesCard() {
  const [vencidos, setVencidos] = useState<RenovacaoUrgente[]>([]);
  const [proximos, setProximos] = useState<RenovacaoUrgente[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [aba, setAba] = useState<"vencidos" | "proximos">("vencidos");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const listFn = useServerFn(listRenovacoesUrgentes);
  const enviarFn = useServerFn(enviarCobrancaRenovacao);
  const resolverFn = useServerFn(marcarRenovacaoResolvida);

  async function carregar() {
    setLoading(true);
    try {
      const r = await listFn();
      setVencidos(r.vencidos);
      setProximos(r.proximos);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function enviarCobranca(id: string) {
    setBusyId(id);
    try {
      const r = await enviarFn({ data: { alunoId: id } });
      if (r.ok) {
        toast.success("Cobrança enviada");
        startTransition(() => { void carregar(); });
      } else toast.error(r.error || "Falha ao enviar");
    } finally { setBusyId(null); }
  }

  async function marcarResolvido(id: string) {
    setBusyId(id);
    try {
      const r = await resolverFn({ data: { alunoId: id } });
      if (r.ok) {
        toast.success("Marcado como aguardando renovação");
        startTransition(() => { void carregar(); });
      } else toast.error(r.error || "Falha");
    } finally { setBusyId(null); }
  }

  const total = vencidos.length + proximos.length;
  const lista = aba === "vencidos" ? vencidos : proximos;

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando renovações...
        </div>
      </div>
    );
  }

  if (total === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border-2 border-destructive/40 bg-destructive/5 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-destructive/10 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive text-destructive-foreground">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-sm sm:text-base">Renovações urgentes</div>
            <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-destructive" />
                Vencidos: <strong className="text-destructive">{vencidos.length}</strong>
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3 text-amber-600" />
                Vencem em 7 dias: <strong className="text-amber-700">{proximos.length}</strong>
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden sm:inline text-xs text-muted-foreground">{open ? "Fechar" : "Ver alunos"}</span>
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-destructive/30 bg-card">
          <div className="flex border-b border-border text-sm">
            <button
              onClick={() => setAba("vencidos")}
              className={`px-4 py-2 font-medium border-b-2 -mb-px ${
                aba === "vencidos"
                  ? "border-destructive text-destructive"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Vencidos ({vencidos.length})
            </button>
            <button
              onClick={() => setAba("proximos")}
              className={`px-4 py-2 font-medium border-b-2 -mb-px ${
                aba === "proximos"
                  ? "border-amber-600 text-amber-700"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Vencem em 7 dias ({proximos.length})
            </button>
          </div>

          <div className="divide-y divide-border max-h-96 overflow-y-auto">
            {lista.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">Nada por aqui 🎉</div>
            ) : lista.map((a) => {
              const vencido = a.dias < 0;
              const diasTxt = vencido
                ? `Vencido há ${Math.abs(a.dias)} ${Math.abs(a.dias) === 1 ? "dia" : "dias"}`
                : a.dias === 0 ? "Vence hoje" : `Vence em ${a.dias} ${a.dias === 1 ? "dia" : "dias"}`;
              return (
                <div key={a.id} className="p-3 sm:p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          to="/alunos/$id"
                          params={{ id: a.id }}
                          className="font-semibold text-sm hover:underline truncate"
                        >
                          {a.nome}
                        </Link>
                        {a.modalidade && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            {MOD_LABEL[a.modalidade] ?? a.modalidade}
                          </span>
                        )}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          vencido ? "bg-destructive/15 text-destructive" : "bg-amber-100 text-amber-700"
                        }`}>
                          {diasTxt}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                        <span>Plano: <strong className="text-foreground">{a.plano ?? "—"}</strong></span>
                        <span>Status: {a.status}</span>
                        <span>Tel: {a.whatsapp || "—"}</span>
                        <span>Vence: {fmtData(a.data_expiracao)}</span>
                        <span>Última cobrança: <strong className="text-foreground">{fmtRelativo(a.ultima_cobranca_em)}</strong></span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => enviarCobranca(a.id)}
                        disabled={busyId === a.id || !a.whatsapp}
                        title="Enviar cobrança via WhatsApp"
                        className="inline-flex items-center gap-1 rounded-md bg-primary text-primary-foreground px-2.5 py-1.5 text-xs font-medium hover:opacity-90 disabled:opacity-50"
                      >
                        {busyId === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                        <span className="hidden sm:inline">Cobrança</span>
                      </button>
                      <a
                        href={whatsappHref(a.whatsapp)}
                        target="_blank"
                        rel="noreferrer"
                        title="Abrir WhatsApp"
                        className="inline-flex items-center justify-center h-7 w-7 rounded-md border border-border hover:bg-muted text-emerald-600"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                      </a>
                      <Link
                        to="/alunos/$id"
                        params={{ id: a.id }}
                        title="Abrir ficha do aluno"
                        className="inline-flex items-center justify-center h-7 w-7 rounded-md border border-border hover:bg-muted"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                      <button
                        onClick={() => marcarResolvido(a.id)}
                        disabled={busyId === a.id}
                        title="Marcar como aguardando renovação"
                        className="inline-flex items-center justify-center h-7 w-7 rounded-md border border-border hover:bg-muted text-emerald-600 disabled:opacity-50"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}