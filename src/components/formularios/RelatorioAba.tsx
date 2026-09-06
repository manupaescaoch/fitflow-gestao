import { useEffect, useMemo, useState } from "react";
import { Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import { supabase as supabaseClient } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { STATUS_TRATATIVA, PRIORIDADES } from "@/components/formularios/TratativaPanel";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = supabaseClient as any;

interface ItemBruto { pergunta_titulo: string; pergunta_tipo: string; valor_texto: string | null; valor_num: number | null }
interface RespostaBruta {
  id: string; status: string; prioridade: string; enviado_em: string; duracao_seg: number | null;
  form_resposta_itens: ItemBruto[];
}

const TIPOS_CATEGORICOS = ["multipla_escolha", "caixas", "lista", "sim_nao"];
const TIPOS_NUMERICOS = ["escala", "estrelas", "nps", "numero"];

export function RelatorioAba({ formularioId, titulo }: { formularioId: string; titulo: string }) {
  const [linhas, setLinhas] = useState<RespostaBruta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("form_respostas")
        .select("id, status, prioridade, enviado_em, duracao_seg, form_resposta_itens(pergunta_titulo, pergunta_tipo, valor_texto, valor_num)")
        .eq("formulario_id", formularioId)
        .order("enviado_em", { ascending: false })
        .limit(1000);
      setLinhas((data ?? []) as RespostaBruta[]);
      setLoading(false);
    })();
  }, [formularioId]);

  const porStatus = useMemo(() => contar(linhas.map((r) => rotulo(STATUS_TRATATIVA, r.status || "nova"))), [linhas]);
  const porPrioridade = useMemo(() => contar(linhas.map((r) => rotulo(PRIORIDADES, r.prioridade || "normal"))), [linhas]);

  const porDia = useMemo(() => {
    const mapa = new Map<string, number>();
    linhas.forEach((r) => {
      const d = new Date(r.enviado_em).toLocaleDateString("pt-BR");
      mapa.set(d, (mapa.get(d) ?? 0) + 1);
    });
    return [...mapa.entries()].slice(0, 14).reverse();
  }, [linhas]);

  const tempoMedio = useMemo(() => {
    const vals = linhas.map((r) => r.duracao_seg).filter((v): v is number => typeof v === "number" && v > 0);
    if (!vals.length) return null;
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  }, [linhas]);

  const perguntas = useMemo(() => {
    const cat = new Map<string, Map<string, number>>();
    const num = new Map<string, { soma: number; n: number; min: number; max: number }>();
    linhas.forEach((r) => (r.form_resposta_itens ?? []).forEach((i) => {
      if (TIPOS_CATEGORICOS.includes(i.pergunta_tipo)) {
        const m = cat.get(i.pergunta_titulo) ?? new Map<string, number>();
        (i.valor_texto ?? "—").split(", ").forEach((v) => m.set(v || "—", (m.get(v || "—") ?? 0) + 1));
        cat.set(i.pergunta_titulo, m);
      } else if (TIPOS_NUMERICOS.includes(i.pergunta_tipo) && i.valor_num != null) {
        const cur = num.get(i.pergunta_titulo) ?? { soma: 0, n: 0, min: Infinity, max: -Infinity };
        num.set(i.pergunta_titulo, {
          soma: cur.soma + i.valor_num, n: cur.n + 1,
          min: Math.min(cur.min, i.valor_num), max: Math.max(cur.max, i.valor_num),
        });
      }
    }));
    return { cat: [...cat.entries()], num: [...num.entries()] };
  }, [linhas]);

  function exportarRelatorio() {
    const l: string[][] = [["Indicador", "Valor"]];
    l.push(["Total de respostas", String(linhas.length)]);
    if (tempoMedio != null) l.push(["Tempo médio de preenchimento (s)", String(tempoMedio)]);
    porStatus.forEach(([k, v]) => l.push([`Status: ${k}`, String(v)]));
    porPrioridade.forEach(([k, v]) => l.push([`Prioridade: ${k}`, String(v)]));
    perguntas.num.forEach(([k, v]) => l.push([`Média — ${k}`, (v.soma / v.n).toFixed(2)]));
    perguntas.cat.forEach(([k, m]) => [...m.entries()].forEach(([op, n]) => l.push([`${k} — ${op}`, String(n)])));
    const csv = l.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `relatorio-${titulo.toLowerCase().replace(/\s+/g, "-")}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Relatório exportado");
  }

  if (loading) {
    return <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Calculando relatório…</div>;
  }

  const maxDia = Math.max(1, ...porDia.map(([, v]) => v));

  return (
    <div className="mt-5 space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={exportarRelatorio}>
          <Download className="mr-2 h-3.5 w-3.5" /> Exportar relatório
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Indicador titulo="Respostas analisadas" valor={String(linhas.length)} />
        <Indicador titulo="Tratativas concluídas" valor={String(linhas.filter((r) => r.status === "concluida").length)} />
        <Indicador titulo="Tempo médio" valor={tempoMedio != null ? `${Math.floor(tempoMedio / 60)}m ${tempoMedio % 60}s` : "—"} />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Bloco titulo="Por status da tratativa" dados={porStatus} />
        <Bloco titulo="Por prioridade" dados={porPrioridade} />
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">Respostas por dia</h2>
        {porDia.length === 0 ? <p className="text-xs text-muted-foreground">Sem dados.</p> : (
          <div className="flex h-32 items-end gap-1.5">
            {porDia.map(([dia, n]) => (
              <div key={dia} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] text-muted-foreground">{n}</span>
                <div className="w-full rounded-t bg-rose-500" style={{ height: `${(n / maxDia) * 90}%` }} />
                <span className="text-[9px] text-muted-foreground">{dia.slice(0, 5)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {perguntas.num.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Perguntas com nota</h2>
          <div className="space-y-3">
            {perguntas.num.map(([k, v]) => (
              <div key={k}>
                <div className="flex justify-between text-xs">
                  <span>{k}</span>
                  <span className="font-medium">média {(v.soma / v.n).toFixed(1)} · mín {v.min} · máx {v.max}</span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-rose-500" style={{ width: `${Math.min(100, (v.soma / v.n / (v.max || 10)) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {perguntas.cat.map(([k, m]) => (
        <Bloco key={k} titulo={k} dados={[...m.entries()].sort((a, b) => b[1] - a[1])} />
      ))}
    </div>
  );
}

function rotulo(lista: { value: string; label: string }[], v: string) {
  return lista.find((x) => x.value === v)?.label ?? v;
}

function contar(vals: string[]): [string, number][] {
  const m = new Map<string, number>();
  vals.forEach((v) => m.set(v, (m.get(v) ?? 0) + 1));
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function Indicador({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className="mt-1 text-xl font-bold">{valor}</p>
    </div>
  );
}

function Bloco({ titulo, dados }: { titulo: string; dados: [string, number][] }) {
  const total = dados.reduce((a, [, v]) => a + v, 0) || 1;
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h2 className="mb-3 text-sm font-semibold">{titulo}</h2>
      {dados.length === 0 ? <p className="text-xs text-muted-foreground">Sem dados.</p> : (
        <div className="space-y-2">
          {dados.map(([k, v]) => (
            <div key={k}>
              <div className="flex justify-between text-xs"><span>{k}</span><span className="font-medium">{v} · {Math.round((v / total) * 100)}%</span></div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-rose-500" style={{ width: `${(v / total) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default RelatorioAba;
