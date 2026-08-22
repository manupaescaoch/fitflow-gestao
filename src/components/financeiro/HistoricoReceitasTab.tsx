import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { fmtBRL, type Transacao } from "@/lib/financeiro";
import { MODALIDADE_LABEL, type Aluno } from "@/lib/crm";
import { MesAnoSelector } from "./MesAnoSelector";
import { ExportButtons } from "./ExportButtons";

export function HistoricoReceitasTab() {
  const hoje = new Date();
  const [ano, setAno] = useState<number>(hoje.getFullYear());
  const [mes, setMes] = useState<number>(hoje.getMonth());
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [filtroPor, setFiltroPor] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    async function load() {
      setLoading(true);
      const inicio = new Date(ano, mes, 1).toISOString();
      const fim = new Date(ano, mes + 1, 0, 23, 59, 59, 999).toISOString();
      const [tx, al] = await Promise.all([
        supabase.from("transacoes").select("*")
          .eq("tipo", "receita")
          .gte("criado_em", inicio)
          .lte("criado_em", fim)
          .order("criado_em", { ascending: false }),
        supabase.from("alunos").select("id,nome,modalidade"),
      ]);
      if (cancel) return;
      setTransacoes((tx.data ?? []) as Transacao[]);
      setAlunos((al.data ?? []) as Aluno[]);
      setLoading(false);
    }
    void load();
    return () => { cancel = true; };
  }, [ano, mes]);

  const alunosPorId = useMemo(() => {
    const m = new Map<string, Aluno>();
    for (const a of alunos) m.set(a.id, a);
    return m;
  }, [alunos]);

  const cadastrantes = useMemo(() => {
    const set = new Set<string>();
    for (const t of transacoes) if (t.criado_por) set.add(t.criado_por);
    return Array.from(set).sort();
  }, [transacoes]);

  const filtradas = useMemo(() => {
    if (!filtroPor) return transacoes;
    return transacoes.filter((t) => (t.criado_por ?? "") === filtroPor);
  }, [transacoes, filtroPor]);

  const ultimaEm = filtradas[0]?.criado_em
    ? new Date(filtradas[0].criado_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
    : null;

  const exportRows = filtradas.map((t) => {
    const al = t.aluno_id ? alunosPorId.get(t.aluno_id) : null;
    return [
      new Date(t.criado_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }),
      t.data_transacao ? new Date(t.data_transacao).toLocaleDateString("pt-BR") : "—",
      al?.nome ?? "—",
      al?.modalidade ? MODALIDADE_LABEL[al.modalidade] : "—",
      Number(t.valor).toFixed(2),
      t.origem,
      t.criado_por ?? "—",
    ];
  });

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold">Histórico de receitas cadastradas</h2>
          <p className="text-xs fin-muted mt-1">
            {loading
              ? "Carregando…"
              : `${filtradas.length} receita${filtradas.length === 1 ? "" : "s"} no mês${ultimaEm ? ` — última em ${ultimaEm}` : ""}.`}
          </p>
        </div>
        <ExportButtons
          filename={`historico-receitas-${ano}-${String(mes + 1).padStart(2, "0")}`}
          title="Histórico de receitas"
          columns={["Cadastrado em", "Data da venda", "Aluno", "Modalidade", "Valor", "Origem", "Cadastrado por"]}
          rows={exportRows}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <MesAnoSelector ano={ano} mes={mes} onChange={(a, m) => { setAno(a); setMes(m); }} />
        {cadastrantes.length > 0 && (
          <select
            value={filtroPor}
            onChange={(e) => setFiltroPor(e.target.value)}
            className="h-8 px-2 rounded-lg text-xs border"
            style={{ borderColor: "var(--fin-border, #e5e7eb)" }}
          >
            <option value="">Todos os cadastrantes</option>
            {cadastrantes.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}
      </div>

      <div className="overflow-x-auto fin-card p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-3 px-4 text-xs font-medium">Cadastrado em</th>
              <th className="text-left text-xs font-medium">Data da venda</th>
              <th className="text-left text-xs font-medium">Aluno</th>
              <th className="text-left text-xs font-medium">Modalidade</th>
              <th className="text-right text-xs font-medium">Valor</th>
              <th className="text-left text-xs font-medium pl-4">Origem</th>
              <th className="text-left pr-4 text-xs font-medium">Cadastrado por</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map((t) => {
              const al = t.aluno_id ? alunosPorId.get(t.aluno_id) : null;
              const dt = new Date(t.criado_em);
              return (
                <tr key={t.id} className="border-b last:border-0">
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div>{dt.toLocaleDateString("pt-BR")}</div>
                    <div className="text-xs fin-muted">
                      {dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </td>
                  <td className="whitespace-nowrap">
                    {t.data_transacao ? new Date(t.data_transacao).toLocaleDateString("pt-BR") : "—"}
                  </td>
                  <td>
                    {al ? (
                      <Link
                        to="/alunos/$id"
                        params={{ id: al.id }}
                        className="hover:underline"
                        style={{ color: "var(--blue)" }}
                      >
                        {al.nome}
                      </Link>
                    ) : "—"}
                  </td>
                  <td className="fin-muted text-xs">
                    {al?.modalidade ? MODALIDADE_LABEL[al.modalidade] : "—"}
                  </td>
                  <td className="text-right font-semibold" style={{ color: "var(--green)" }}>
                    {fmtBRL(Number(t.valor))}
                  </td>
                  <td className="capitalize fin-muted pl-4">{t.origem}</td>
                  <td className="pr-4 fin-muted text-xs">{t.criado_por ?? "—"}</td>
                </tr>
              );
            })}
            {!loading && filtradas.length === 0 && (
              <tr>
                <td colSpan={7} className="py-10 text-center fin-muted text-xs">
                  Nenhuma receita cadastrada neste mês ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}