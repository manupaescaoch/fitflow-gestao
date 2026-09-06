import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, Download, Inbox, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase as supabaseClient } from "@/integrations/supabase/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = supabaseClient as any;
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Formulario, mapFormulario } from "@/lib/formularios";
import { TratativaPanel, STATUS_TRATATIVA, PRIORIDADES } from "@/components/formularios/TratativaPanel";
import { RelatorioAba } from "@/components/formularios/RelatorioAba";

export const Route = createFileRoute("/_app/forms/$id/respostas")({
  head: () => ({
    meta: [
      { title: "Respostas do formulário — MPTEAM CRM" },
      { name: "description", content: "Resumo, respostas individuais e tabela completa das respostas recebidas no formulário." },
      { property: "og:title", content: "Respostas do formulário — MPTEAM CRM" },
      { property: "og:description", content: "Resumo e tabela das respostas recebidas no formulário." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RespostasPage,
});

interface Item { pergunta_id: string | null; pergunta_titulo: string; pergunta_tipo: string; valor_texto: string | null; valor_num: number | null; ordem: number }
interface Resposta {
  id: string; protocolo: string; respondente_nome: string | null; respondente_email: string | null;
  respondente_telefone: string | null; status: string; prioridade: string; enviado_em: string;
  responsavel_id: string | null; prazo: string | null;
  itens: Item[];
}

const PAGINA = 20;

function RespostasPage() {
  const { id } = useParams({ from: "/_app/forms/$id/respostas" });
  const nav = useNavigate();
  const [form, setForm] = useState<Formulario | null>(null);
  const [itens, setItens] = useState<Resposta[]>([]);
  const [loading, setLoading] = useState(true);
  const [aba, setAba] = useState<"resumo" | "individual" | "tabela" | "relatorios">("resumo");
  const [pagina, setPagina] = useState(0);
  const [total, setTotal] = useState(0);
  const [atual, setAtual] = useState(0);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: f } = await supabase.from("form_formularios").select("*").eq("id", id).maybeSingle();
      if (f) setForm(mapFormulario(f as Record<string, unknown>));
      const { data, count } = await supabase
        .from("form_respostas")
        .select("*, form_resposta_itens(*)", { count: "exact" })
        .eq("formulario_id", id)
        .order("enviado_em", { ascending: false })
        .range(pagina * PAGINA, pagina * PAGINA + PAGINA - 1);
      setTotal(count ?? 0);
      setItens(((data ?? []) as Record<string, unknown>[]).map((r) => ({
        ...(r as unknown as Resposta),
        itens: ((r["form_resposta_itens"] as Item[]) ?? []).slice().sort((a, b) => a.ordem - b.ordem),
      })));
      setLoading(false);
    })();
  }, [id, pagina]);

  const colunas = useMemo(() => {
    const set = new Map<string, string>();
    itens.forEach((r) => r.itens.forEach((i) => set.set(i.pergunta_titulo, i.pergunta_titulo)));
    return [...set.keys()];
  }, [itens]);

  const filtrados = useMemo(() => {
    const nq = q.trim().toLowerCase();
    if (!nq) return itens;
    return itens.filter((r) =>
      (r.respondente_nome ?? "").toLowerCase().includes(nq) ||
      r.protocolo.toLowerCase().includes(nq) ||
      r.itens.some((i) => (i.valor_texto ?? "").toLowerCase().includes(nq)));
  }, [itens, q]);

  const medias = useMemo(() => {
    const acc = new Map<string, { soma: number; n: number }>();
    itens.forEach((r) => r.itens.forEach((i) => {
      if (i.valor_num == null) return;
      const cur = acc.get(i.pergunta_titulo) ?? { soma: 0, n: 0 };
      acc.set(i.pergunta_titulo, { soma: cur.soma + i.valor_num, n: cur.n + 1 });
    }));
    return [...acc.entries()].map(([k, v]) => ({ pergunta: k, media: v.soma / v.n }));
  }, [itens]);

  function exportarCsv() {
    const head = ["Protocolo", "Enviado em", "Nome", "E-mail", "Telefone", ...colunas];
    const linhas = filtrados.map((r) => [
      r.protocolo, new Date(r.enviado_em).toLocaleString("pt-BR"),
      r.respondente_nome ?? "", r.respondente_email ?? "", r.respondente_telefone ?? "",
      ...colunas.map((c) => r.itens.find((i) => i.pergunta_titulo === c)?.valor_texto ?? ""),
    ]);
    const csv = [head, ...linhas].map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `respostas-${form?.slug ?? id}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Arquivo exportado");
  }

  const hoje = itens.filter((r) => new Date(r.enviado_em).toDateString() === new Date().toDateString()).length;
  const r = filtrados[atual];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => nav({ to: "/forms" })}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Formulários
        </Button>
        <h1 className="text-lg font-bold">{form?.titulo ?? "Respostas"}</h1>
        <Button variant="outline" size="sm" className="ml-auto" onClick={exportarCsv}>
          <Download className="mr-2 h-3.5 w-3.5" /> Exportar CSV
        </Button>
      </div>

      <div className="mt-4 flex gap-2 border-b border-border pb-3">
        {(["resumo", "individual", "tabela", "relatorios"] as const).map((k) => (
          <button key={k} onClick={() => setAba(k)}
            className={`rounded-lg px-3 py-1.5 text-[13px] capitalize transition-colors ${
              aba === k ? "bg-rose-50 font-medium text-rose-600" : "text-muted-foreground hover:bg-muted/40"}`}>
            {k}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando respostas…
        </div>
      ) : total === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-border py-16 text-center">
          <Inbox className="mx-auto h-8 w-8 text-muted-foreground/60" />
          <p className="mt-3 text-sm font-medium">Nenhuma resposta ainda</p>
          <p className="text-xs text-muted-foreground">Compartilhe o link do formulário para começar a receber respostas.</p>
        </div>
      ) : aba === "resumo" ? (
        <div className="mt-5 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Card titulo="Total de respostas" valor={String(total)} />
            <Card titulo="Recebidas hoje" valor={String(hoje)} />
            <Card titulo="Última resposta" valor={form?.ultima_resposta_em ? new Date(form.ultima_resposta_em).toLocaleString("pt-BR") : "—"} />
          </div>
          {medias.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <h2 className="mb-3 text-sm font-semibold">Médias das avaliações</h2>
              <div className="space-y-2">
                {medias.map((m) => (
                  <div key={m.pergunta}>
                    <div className="flex justify-between text-xs"><span>{m.pergunta}</span><span className="font-medium">{m.media.toFixed(1)}</span></div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-rose-500" style={{ width: `${Math.min(100, (m.media / 10) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : aba === "individual" ? (
        <div className="mt-5">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" disabled={atual === 0} onClick={() => setAtual((i) => i - 1)} aria-label="Anterior">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">{atual + 1} de {filtrados.length}</span>
            <Button variant="outline" size="icon" disabled={atual >= filtrados.length - 1} onClick={() => setAtual((i) => i + 1)} aria-label="Próxima">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" className="ml-auto" onClick={() => window.print()}>Imprimir</Button>
          </div>
          {r && (
            <div className="mt-3 rounded-xl border border-border bg-card p-5">
              <div className="text-xs text-muted-foreground">
                Protocolo {r.protocolo} · {new Date(r.enviado_em).toLocaleString("pt-BR")}
                {r.respondente_nome ? ` · ${r.respondente_nome}` : " · anônimo"}
              </div>
              <div className="mt-4 space-y-3">
                {r.itens.map((i, k) => (
                  <div key={k}>
                    <p className="text-xs font-medium text-muted-foreground">{i.pergunta_titulo}</p>
                    <p className="text-sm">{i.valor_texto || "—"}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {r && (
            <div className="mt-3">
              <TratativaPanel
                resposta={{ id: r.id, protocolo: r.protocolo, status: r.status, prioridade: r.prioridade, responsavel_id: r.responsavel_id, prazo: r.prazo }}
                onAtualizado={(patch) =>
                  setItens((prev) => prev.map((x) => (x.id === r.id ? { ...x, ...patch } as Resposta : x)))
                }
              />
            </div>
          )}
        </div>
      ) : aba === "relatorios" ? (
        <RelatorioAba formularioId={id} titulo={form?.titulo ?? "formulario"} />
      ) : (
        <div className="mt-5">
          <div className="relative mb-3 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar nas respostas" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5">Protocolo</th><th className="px-3 py-2.5">Enviado</th>
                  <th className="px-3 py-2.5">Respondente</th><th className="px-3 py-2.5">Tratativa</th>
                  {colunas.map((c) => <th key={c} className="px-3 py-2.5">{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {filtrados.map((row) => (
                  <tr key={row.id} className="border-t border-border align-top">
                    <td className="px-3 py-2.5 whitespace-nowrap">{row.protocolo}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">{new Date(row.enviado_em).toLocaleString("pt-BR")}</td>
                    <td className="px-3 py-2.5">{row.respondente_nome ?? "—"}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-xs">
                      {STATUS_TRATATIVA.find((s) => s.value === (row.status || "nova"))?.label ?? row.status}
                      <span className="text-muted-foreground"> · {PRIORIDADES.find((p) => p.value === (row.prioridade || "normal"))?.label ?? row.prioridade}</span>
                    </td>
                    {colunas.map((c) => (
                      <td key={c} className="px-3 py-2.5">{row.itens.find((i) => i.pergunta_titulo === c)?.valor_texto ?? "—"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center gap-2 text-sm">
            <Button variant="outline" size="sm" disabled={pagina === 0} onClick={() => setPagina((p) => p - 1)}>Anterior</Button>
            <span className="text-muted-foreground">Página {pagina + 1} de {Math.max(1, Math.ceil(total / PAGINA))}</span>
            <Button variant="outline" size="sm" disabled={(pagina + 1) * PAGINA >= total} onClick={() => setPagina((p) => p + 1)}>Próxima</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className="mt-1 text-xl font-bold">{valor}</p>
    </div>
  );
}
