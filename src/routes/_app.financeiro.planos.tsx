import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Save, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { readCache, writeCache } from "@/lib/swr-cache";
import { useAuth } from "@/lib/auth";
import { MODALIDADE_LABEL, type Modalidade } from "@/lib/crm";
import { fmtBRL } from "@/lib/financeiro";

export const Route = createFileRoute("/_app/financeiro/planos")({
  component: PlanosPage,
});

type PlanoCatalogo = {
  id: string;
  nome: string;
  modalidade: Modalidade;
  valor_padrao: number;
  duracao_dias: number;
  ativo: boolean;
  descricao: string | null;
  criado_em: string;
};

const MODALIDADES: Modalidade[] = ["mpteam", "mp_elite", "mp_presencial"];

const planoSchema = z.object({
  nome: z.string().trim().min(1, "Nome é obrigatório").max(100),
  modalidade: z.enum(["mpteam", "mp_elite", "mp_presencial"]),
  valor_padrao: z.number().min(0, "Valor inválido"),
  duracao_dias: z.number().int().min(1, "Duração deve ser ≥ 1 dia"),
  descricao: z.string().trim().max(500).optional().nullable(),
  ativo: z.boolean(),
});

export function PlanosPage() {
  const { isAdmin } = useAuth();
  const cached = readCache<PlanoCatalogo[]>("fin-planos");
  const [planos, setPlanos] = useState<PlanoCatalogo[]>(cached ?? []);
  const [loading, setLoading] = useState(!cached);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<PlanoCatalogo | null>(null);

  async function carregar() {
    const { data, error } = await supabase
      .from("planos_catalogo")
      .select("*")
      .order("modalidade", { ascending: true })
      .order("valor_padrao", { ascending: true });
    if (error) toast.error("Erro ao carregar planos: " + error.message);
    const list = (data as PlanoCatalogo[]) ?? [];
    setPlanos(list);
    writeCache("fin-planos", list);
    setLoading(false);
  }

  useEffect(() => {
    void carregar();
    const ch = supabase
      .channel("fin-planos-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "planos_catalogo" }, () => { void carregar(); })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, []);

  async function excluir(p: PlanoCatalogo) {
    if (!confirm(`Excluir o plano "${p.nome}"?`)) return;
    const { error } = await supabase.from("planos_catalogo").delete().eq("id", p.id);
    if (error) { toast.error("Erro ao excluir: " + error.message); return; }
    toast.success("Plano excluído");
    void carregar();
  }

  const porModalidade = useMemo(() => {
    const map = new Map<Modalidade, PlanoCatalogo[]>();
    MODALIDADES.forEach((m) => map.set(m, []));
    planos.forEach((p) => map.get(p.modalidade)?.push(p));
    return map;
  }, [planos]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Planos comerciais</h1>
          <p className="text-sm text-slate-500 mt-1">
            Cadastre os planos oferecidos com valor padrão e duração para reutilizar no cadastro de alunos.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => { setEditing(null); setShowModal(true); }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--blue)] text-white text-sm font-medium hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Novo plano
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-sm text-slate-500">Carregando…</div>
      ) : planos.length === 0 ? (
        <div className="fin-card p-8 text-center text-slate-500 text-sm">
          Nenhum plano cadastrado ainda.
          {isAdmin && " Clique em \"Novo plano\" para adicionar o primeiro."}
        </div>
      ) : (
        <div className="space-y-6">
          {MODALIDADES.map((mod) => {
            const lista = porModalidade.get(mod) ?? [];
            if (lista.length === 0) return null;
            return (
              <div key={mod}>
                <h2 className="text-sm font-semibold text-slate-700 mb-2 uppercase tracking-wide">
                  {MODALIDADE_LABEL[mod]}
                </h2>
                <div className="overflow-x-auto fin-card p-0">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 text-xs font-medium">Nome</th>
                        <th className="text-right text-xs font-medium">Valor padrão</th>
                        <th className="text-right text-xs font-medium">Duração</th>
                        <th className="text-center text-xs font-medium">Status</th>
                        {isAdmin && <th className="text-right pr-4 text-xs font-medium">Ações</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {lista.map((p) => (
                        <tr key={p.id} className="border-b last:border-0">
                          <td className="py-3 px-4">
                            <div className="font-medium">{p.nome}</div>
                            {p.descricao && (
                              <div className="text-xs text-slate-500 mt-0.5">{p.descricao}</div>
                            )}
                          </td>
                          <td className="text-right">{fmtBRL(p.valor_padrao)}</td>
                          <td className="text-right">{p.duracao_dias} dias</td>
                          <td className="text-center">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                                p.ativo
                                  ? "bg-green-100 text-green-700"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {p.ativo ? "Ativo" : "Inativo"}
                            </span>
                          </td>
                          {isAdmin && (
                            <td className="text-right pr-4">
                              <div className="inline-flex items-center gap-1">
                                <button
                                  onClick={() => { setEditing(p); setShowModal(true); }}
                                  className="p-1.5 hover:bg-slate-100 rounded text-slate-600"
                                  title="Editar"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => void excluir(p)}
                                  className="p-1.5 hover:bg-red-50 rounded text-red-600"
                                  title="Excluir"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <PlanoModal
          plano={editing}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); void carregar(); }}
        />
      )}
    </div>
  );
}

function PlanoModal({
  plano, onClose, onSaved,
}: {
  plano: PlanoCatalogo | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState(plano?.nome ?? "");
  const [modalidade, setModalidade] = useState<Modalidade>(plano?.modalidade ?? "mpteam");
  const [valor, setValor] = useState<string>(plano ? String(plano.valor_padrao) : "");
  const [duracao, setDuracao] = useState<string>(plano ? String(plano.duracao_dias) : "30");
  const [descricao, setDescricao] = useState(plano?.descricao ?? "");
  const [ativo, setAtivo] = useState(plano?.ativo ?? true);
  const [saving, setSaving] = useState(false);

  async function salvar() {
    const parsed = planoSchema.safeParse({
      nome,
      modalidade,
      valor_padrao: Number(valor),
      duracao_dias: Number(duracao),
      descricao: descricao || null,
      ativo,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    setSaving(true);
    const payload = parsed.data;
    const { error } = plano
      ? await supabase.from("planos_catalogo").update(payload).eq("id", plano.id)
      : await supabase.from("planos_catalogo").insert(payload);
    setSaving(false);
    if (error) { toast.error("Erro ao salvar: " + error.message); return; }
    toast.success(plano ? "Plano atualizado" : "Plano criado");
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 px-safe">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-lg font-semibold">{plano ? "Editar plano" : "Novo plano"}</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <Field label="Nome do plano">
            <input
              type="text" value={nome} onChange={(e) => setNome(e.target.value)}
              maxLength={100} placeholder="Ex.: Plano Trimestral"
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </Field>
          <Field label="Modalidade">
            <select
              value={modalidade} onChange={(e) => setModalidade(e.target.value as Modalidade)}
              className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
            >
              {MODALIDADES.map((m) => (
                <option key={m} value={m}>{MODALIDADE_LABEL[m]}</option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor padrão (R$)">
              <input
                type="number" min="0" step="0.01" value={valor}
                onChange={(e) => setValor(e.target.value)} placeholder="0,00"
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </Field>
            <Field label="Duração (dias)">
              <input
                type="number" min="1" step="1" value={duracao}
                onChange={(e) => setDuracao(e.target.value)} placeholder="30"
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </Field>
          </div>
          <Field label="Descrição (opcional)">
            <textarea
              value={descricao} onChange={(e) => setDescricao(e.target.value)}
              maxLength={500} rows={3}
              placeholder="Detalhes ou observações sobre o plano"
              className="w-full px-3 py-2 border rounded-lg text-sm resize-none"
            />
          </Field>
          <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox" checked={ativo}
              onChange={(e) => setAtivo(e.target.checked)}
              className="h-4 w-4"
            />
            Plano ativo
          </label>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t bg-slate-50 rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg hover:bg-slate-200"
          >
            Cancelar
          </button>
          <button
            onClick={() => void salvar()} disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-[var(--blue)] text-white font-medium hover:opacity-90 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-600 mb-1">{label}</span>
      {children}
    </label>
  );
}