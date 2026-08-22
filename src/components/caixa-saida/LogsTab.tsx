import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, Search, Loader2, ChevronDown, ChevronRight, Trash2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { waMeUrl } from "@/lib/wa-link";

type LogRow = {
  id: string;
  aluno_id: string | null;
  aluno_nome: string | null;
  origem: string;
  tipo_evento: string;
  data_referencia: string | null;
  data_base: string | null;
  resultado: string;
  detalhes: Record<string, unknown> | null;
  criado_em: string;
};

const TIPOS = ["entrega_inicial", "anamnese_publica", "feedback_mensal"] as const;
const RESULTADOS = ["criado", "ja_existia", "erro"] as const;

export function LogsTab() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState<string>("");
  const [resultado, setResultado] = useState<string>("");
  const [dataInicio, setDataInicio] = useState<string>("");
  const [dataFim, setDataFim] = useState<string>("");
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({});
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [apagandoLote, setApagandoLote] = useState(false);
  const [whatsappMap, setWhatsappMap] = useState<Map<string, string | null>>(new Map());

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("entregas_dia_log")
      .select("*")
      .order("criado_em", { ascending: false })
      .limit(500);

    if (tipo) q = q.eq("tipo_evento", tipo);
    if (resultado) q = q.eq("resultado", resultado);
    if (dataInicio) q = q.gte("criado_em", `${dataInicio}T00:00:00`);
    if (dataFim) q = q.lte("criado_em", `${dataFim}T23:59:59`);

    const { data, error } = await q;
    if (error) console.error(error);
    const rs = (data ?? []) as unknown as LogRow[];
    setRows(rs);
    // Busca whatsapp dos alunos visíveis
    const ids = Array.from(new Set(rs.map((r) => r.aluno_id).filter((x): x is string => !!x)));
    if (ids.length) {
      const { data: alunos } = await supabase.from("alunos").select("id, whatsapp").in("id", ids);
      const m = new Map<string, string | null>();
      (alunos ?? []).forEach((a) => m.set(a.id, a.whatsapp));
      setWhatsappMap(m);
    } else {
      setWhatsappMap(new Map());
    }
    setSelecionados(new Set());
    setLoading(false);
  };

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tipo, resultado, dataInicio, dataFim]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return rows;
    return rows.filter((r) => (r.aluno_nome ?? "").toLowerCase().includes(termo));
  }, [rows, busca]);

  const toggleExpand = (id: string) =>
    setExpandidos((p) => ({ ...p, [id]: !p[id] }));

  const limparFiltros = () => {
    setBusca(""); setTipo(""); setResultado(""); setDataInicio(""); setDataFim("");
  };

  function toggleOne(id: string) {
    setSelecionados((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  function toggleAll() {
    setSelecionados((prev) => {
      if (prev.size === filtrados.length) return new Set();
      return new Set(filtrados.map((r) => r.id));
    });
  }

  async function apagarSelecionados() {
    const ids = Array.from(selecionados);
    if (ids.length === 0) return;
    if (!confirm(`Apagar ${ids.length} log(s) selecionado(s)? Essa ação não pode ser desfeita.`)) return;
    setApagandoLote(true);
    try {
      const { error } = await supabase.from("entregas_dia_log").delete().in("id", ids);
      if (error) {
        toast.error("Falha ao apagar: " + error.message);
      } else {
        toast.success(`${ids.length} log(s) apagado(s)`);
        await load();
      }
    } finally {
      setApagandoLote(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm text-muted-foreground">
            Registros de quando os automatismos criam (ou tentam criar) tarefas em "Atualizações do Dia".
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Mostrando os últimos 500 registros. Use os filtros para refinar.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void apagarSelecionados()}
            disabled={apagandoLote || selecionados.size === 0}
            className="inline-flex items-center gap-2 rounded-md border border-destructive/40 bg-background text-destructive px-3 py-2 text-sm hover:bg-destructive/10 disabled:opacity-50"
          >
            {apagandoLote ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {selecionados.size > 0 ? `Apagar ${selecionados.size} selecionado(s)` : "Apagar selecionados"}
          </button>
          <button
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-muted transition-colors"
          >
            <RefreshCw className="h-4 w-4" /> Atualizar
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 grid gap-3 md:grid-cols-5">
        <label className="block md:col-span-2">
          <span className="text-xs font-medium text-muted-foreground">Buscar aluno</span>
          <div className="mt-1 relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Nome do aluno…"
              className="w-full rounded-md border border-input bg-background pl-7 pr-3 py-2 text-sm"
            />
          </div>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Tipo de evento</span>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-2 py-2 text-sm"
          >
            <option value="">Todos</option>
            {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Resultado</span>
          <select
            value={resultado}
            onChange={(e) => setResultado(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-2 py-2 text-sm"
          >
            <option value="">Todos</option>
            {RESULTADOS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <div className="md:col-span-1 grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">De</span>
            <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-2 py-2 text-sm" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Até</span>
            <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-2 py-2 text-sm" />
          </label>
        </div>
        <div className="md:col-span-5 flex justify-end">
          <button
            onClick={limparFiltros}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Limpar filtros
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground border-b border-border">
            <tr>
              <th className="w-8 px-3 py-3 text-center">
                <input
                  type="checkbox"
                  checked={filtrados.length > 0 && selecionados.size === filtrados.length}
                  ref={(el) => { if (el) el.indeterminate = selecionados.size > 0 && selecionados.size < filtrados.length; }}
                  onChange={toggleAll}
                  aria-label="Selecionar todos"
                />
              </th>
              <th className="w-8"></th>
              <th className="text-left px-3 py-3 font-medium">Quando</th>
              <th className="text-left font-medium">Aluno</th>
              <th className="text-left font-medium">Tipo</th>
              <th className="text-left font-medium">Origem</th>
              <th className="text-left font-medium">Data ref.</th>
              <th className="text-left font-medium">Resultado</th>
              <th className="text-right pr-3 font-medium">Ação</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Carregando…
              </td></tr>
            ) : filtrados.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                Nenhum log encontrado.
              </td></tr>
            ) : filtrados.map((r) => {
              const aberto = !!expandidos[r.id];
              const wa = r.aluno_id ? waMeUrl(whatsappMap.get(r.aluno_id), `Olá ${r.aluno_nome?.split(" ")[0] ?? ""}!`.trim()) : null;
              return (
                <>
                  <tr key={r.id} className="border-b border-border/40 hover:bg-muted/30">
                    <td className="px-3 text-center">
                      <input
                        type="checkbox"
                        checked={selecionados.has(r.id)}
                        onChange={() => toggleOne(r.id)}
                        aria-label={`Selecionar log ${r.id}`}
                      />
                    </td>
                    <td className="text-center">
                      <button onClick={() => toggleExpand(r.id)} className="text-muted-foreground hover:text-foreground p-1">
                        {aberto ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap">
                      {new Date(r.criado_em).toLocaleString("pt-BR")}
                    </td>
                    <td className="text-xs">{r.aluno_nome ?? <span className="text-muted-foreground">—</span>}</td>
                    <td className="text-xs"><code className="text-[11px]">{r.tipo_evento}</code></td>
                    <td className="text-xs text-muted-foreground"><code className="text-[11px]">{r.origem}</code></td>
                    <td className="text-xs">{r.data_referencia ?? "—"}</td>
                    <td>
                      <ResultadoBadge resultado={r.resultado} />
                    </td>
                    <td className="pr-3 text-right">
                      {wa ? (
                        <a
                          href={wa}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10"
                          title="Abrir conversa manual no WhatsApp"
                        >
                          <MessageCircle className="h-3 w-3" /> WhatsApp
                        </a>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                  </tr>
                  {aberto && (
                    <tr key={`${r.id}-det`} className="border-b border-border/40 bg-muted/20">
                      <td></td>
                      <td></td>
                      <td colSpan={7} className="px-3 py-3">
                        <div className="text-xs space-y-1 mb-2">
                          <div><span className="text-muted-foreground">Aluno ID:</span> <code className="text-[11px]">{r.aluno_id ?? "—"}</code></div>
                          <div><span className="text-muted-foreground">Data base:</span> {r.data_base ?? "—"}</div>
                        </div>
                        <div>
                          <div className="text-[11px] text-muted-foreground mb-1">Detalhes:</div>
                          <pre className="text-[11px] bg-background border border-border rounded p-2 overflow-x-auto">
{JSON.stringify(r.detalhes ?? {}, null, 2)}
                          </pre>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ResultadoBadge({ resultado }: { resultado: string }) {
  const cls =
    resultado === "criado" ? "bg-primary/15 text-primary"
    : resultado === "erro" ? "bg-destructive/15 text-destructive"
    : "bg-muted text-muted-foreground";
  return <span className={`text-[11px] px-2 py-0.5 rounded font-medium ${cls}`}>{resultado}</span>;
}