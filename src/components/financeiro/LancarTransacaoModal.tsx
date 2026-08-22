import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { competenciaAtual } from "@/lib/financeiro";
import { toast } from "sonner";
import type { Aluno } from "@/lib/crm";

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

export function LancarTransacaoModal({ onClose, onSaved }: Props) {
  const { crmUser } = useAuth();
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [busca, setBusca] = useState("");
  const [alunoId, setAlunoId] = useState<string>("");
  const [tipo, setTipo] = useState<"receita" | "estorno" | "ajuste">("receita");
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [referencia, setReferencia] = useState("");
  const [competencia, setCompetencia] = useState(competenciaAtual().slice(0, 7));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void supabase.from("alunos").select("id,nome,modalidade,plano,valor_plano,status,whatsapp,data_expiracao,total_renovacoes,renovado,prazo_dias,criado_em,atualizado_em,cpf,email,observacoes,data_compra,data_d0,data_anamnese")
      .order("nome").then(({ data }) => setAlunos((data ?? []) as Aluno[]));
  }, []);

  const filtrados = alunos.filter((a) =>
    !busca || a.nome.toLowerCase().includes(busca.toLowerCase())
  ).slice(0, 8);

  async function salvar() {
    if (!alunoId) { toast.error("Selecione um aluno"); return; }
    const num = Number(valor.replace(",", "."));
    if (!num || isNaN(num)) { toast.error("Valor inválido"); return; }
    const valorFinal = tipo === "estorno" ? -Math.abs(num) : num;
    setSaving(true);
    const { error } = await supabase.from("transacoes").insert({
      aluno_id: alunoId, tipo, origem: "manual", valor: valorFinal,
      descricao: descricao || null, referencia: referencia || null,
      competencia: `${competencia}-01`,
      criado_por: crmUser?.nome ?? crmUser?.email ?? "sistema",
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Transação registrada");
    onSaved();
    onClose();
  }

  const alunoSel = alunos.find((a) => a.id === alunoId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 px-safe">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 text-[#111]">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Lançar transação manual</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-black">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">Aluno</label>
          {alunoSel ? (
            <div className="flex items-center justify-between p-2 rounded-lg bg-gray-50 border">
              <span className="text-sm font-medium">{alunoSel.nome}</span>
              <button onClick={() => { setAlunoId(""); setBusca(""); }} className="text-xs text-red-600">trocar</button>
            </div>
          ) : (
            <>
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar nome…"
                className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm"
              />
              {busca && (
                <div className="border border-gray-200 rounded-lg max-h-44 overflow-auto">
                  {filtrados.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => { setAlunoId(a.id); setBusca(""); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b last:border-0"
                    >
                      {a.nome}
                    </button>
                  ))}
                  {filtrados.length === 0 && <p className="px-3 py-2 text-xs text-gray-500">Nenhum encontrado</p>}
                </div>
              )}
            </>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Tipo</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)}
              className="w-full h-9 px-2 rounded-lg border border-gray-200 text-sm">
              <option value="receita">Receita</option>
              <option value="estorno">Estorno</option>
              <option value="ajuste">Ajuste</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Valor (R$)</label>
            <input value={valor} onChange={(e) => setValor(e.target.value)}
              placeholder="0,00" className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm" />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">Competência</label>
          <input type="month" value={competencia} onChange={(e) => setCompetencia(e.target.value)}
            className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm" />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">Descrição</label>
          <input value={descricao} onChange={(e) => setDescricao(e.target.value)}
            placeholder="Opcional" className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm" />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">Referência</label>
          <input value={referencia} onChange={(e) => setReferencia(e.target.value)}
            placeholder="ID externo, NF, etc." className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm" />
        </div>

        {tipo === "estorno" && (
          <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded-lg">
            O valor será salvo como negativo automaticamente.
          </p>
        )}

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 h-10 rounded-lg border border-gray-200 text-sm font-medium hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={salvar} disabled={saving}
            className="flex-1 h-10 rounded-lg bg-black text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50">
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}