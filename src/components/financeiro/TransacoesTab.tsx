import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Aluno, Modalidade } from "@/lib/crm";
import { MODALIDADE_LABEL } from "@/lib/crm";
import { fmtBRL, type Transacao } from "@/lib/financeiro";
import { ExportButtons } from "./ExportButtons";
import { AcoesTransacaoMenu } from "./AcoesTransacaoMenu";
import { NovaTransacaoModal } from "./NovaTransacaoModal";

interface Props {
  transacoes: Transacao[];
  alunos: Aluno[];
  isAdmin: boolean;
  onAdd: () => void;
  onChanged?: () => void;
}

export function TransacoesTab({ transacoes, alunos, isAdmin, onAdd, onChanged }: Props) {
  const [origem, setOrigem] = useState<"" | "kiwify" | "manual">("");
  const [tipo, setTipo] = useState<"" | "receita" | "estorno" | "ajuste">("");
  const [mod, setMod] = useState<"" | Modalidade>("");
  const [editingTx, setEditingTx] = useState<Transacao | null>(null);

  async function excluir(id: string) {
    const { error } = await supabase.from("transacoes").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Transação excluída.");
    onChanged?.();
  }

  const filtradas = useMemo(() => {
    return transacoes
      .filter((t) => !origem || t.origem === origem)
      .filter((t) => !tipo || t.tipo === tipo)
      .filter((t) => {
        if (!mod) return true;
        const al = alunos.find((a) => a.id === t.aluno_id);
        return al?.modalidade === mod;
      });
  }, [transacoes, alunos, origem, tipo, mod]);

  const exportRows = filtradas.map((t) => {
    const al = alunos.find((a) => a.id === t.aluno_id);
    return [
      new Date(t.criado_em).toLocaleDateString("pt-BR"),
      al?.nome ?? "—", t.tipo, t.origem,
      Number(t.valor).toFixed(2), t.descricao ?? "",
    ];
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2 flex-wrap">
          <select value={origem} onChange={(e) => setOrigem(e.target.value as typeof origem)}
            className="h-8 px-2 rounded-lg text-xs">
            <option value="">Todas origens</option>
            <option value="manual">Manual</option>
            <option value="kiwify">Kiwify</option>
          </select>
          <select value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)}
            className="h-8 px-2 rounded-lg text-xs">
            <option value="">Todos tipos</option>
            <option value="receita">Receita</option>
            <option value="estorno">Estorno</option>
            <option value="ajuste">Ajuste</option>
          </select>
          <select value={mod} onChange={(e) => setMod(e.target.value as typeof mod)}
            className="h-8 px-2 rounded-lg text-xs">
            <option value="">Todas modalidades</option>
            <option value="mpteam">MPTEAM</option>
            <option value="mp_elite">MP Elite</option>
            <option value="mp_presencial">MP Presencial</option>
          </select>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <button onClick={onAdd}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold text-white"
              style={{ background: "var(--text)" }}>
              <Plus className="h-3.5 w-3.5" /> Lançar
            </button>
          )}
          <ExportButtons filename="transacoes" title="Transações"
            columns={["Data", "Aluno", "Tipo", "Origem", "Valor", "Descrição"]} rows={exportRows} />
        </div>
      </div>

      <div className="overflow-x-auto fin-card p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-3 px-4 text-xs font-medium">Data</th>
              <th className="text-left text-xs font-medium">Aluno</th>
              <th className="text-left text-xs font-medium">Modalidade</th>
              <th className="text-left text-xs font-medium">Tipo</th>
              <th className="text-left text-xs font-medium">Origem</th>
              <th className="text-right pr-4 text-xs font-medium">Valor</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {filtradas.slice(0, 50).map((t) => {
              const al = alunos.find((a) => a.id === t.aluno_id);
              const valor = Number(t.valor);
              return (
                <tr key={t.id} className="border-b last:border-0">
                  <td className="py-3 px-4">{new Date(t.criado_em).toLocaleDateString("pt-BR")}</td>
                  <td>{al?.nome ?? "—"}</td>
                  <td className="fin-muted text-xs">{al?.modalidade ? MODALIDADE_LABEL[al.modalidade] : "—"}</td>
                  <td className="capitalize">{t.tipo}</td>
                  <td className="capitalize fin-muted">{t.origem}</td>
                  <td className="text-right pr-4 font-semibold"
                    style={{ color: valor < 0 ? "var(--red)" : "var(--green)" }}>
                    {fmtBRL(valor)}
                  </td>
                  <td className="py-3 px-2">
                    {isAdmin && (
                      <AcoesTransacaoMenu
                        onEdit={() => setEditingTx(t)}
                        onDelete={() => excluir(t.id)}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
            {filtradas.length === 0 && (
              <tr><td colSpan={7} className="py-8 text-center fin-muted text-xs">Nenhuma transação</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editingTx && (
        <NovaTransacaoModal
          transacao={editingTx}
          onClose={() => setEditingTx(null)}
          onSaved={() => { setEditingTx(null); onChanged?.(); }}
        />
      )}
    </div>
  );
}