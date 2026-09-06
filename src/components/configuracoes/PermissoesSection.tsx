import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listPermissoes, savePermissoes } from "@/lib/permissoes.functions";
import { Loader2, Save, Lock } from "lucide-react";

const PERFIL_LABELS: Record<string, string> = {
  admin: "Administrador",
  equipe: "Equipe",
  consultor: "Comercial",
  visualizador: "Visualizador",
};

export function PermissoesSection() {
  const fetch = useServerFn(listPermissoes);
  const persist = useServerFn(savePermissoes);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<Record<string, boolean>>({});
  const [original, setOriginal] = useState<Record<string, boolean>>({});
  const [modulos, setModulos] = useState<string[]>([]);
  const [perfis, setPerfis] = useState<string[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch();
      setModulos(res.modulos);
      setPerfis(res.perfis);
      const map: Record<string, boolean> = {};
      res.permissoes.forEach((p) => {
        map[`${p.modulo}:${p.perfil}`] = p.ativo;
      });
      setValues(map);
      setOriginal(map);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao carregar permissões");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const toggle = (modulo: string, perfil: string) => {
    if (perfil === "admin") return;
    const key = `${modulo}:${perfil}`;
    setValues((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const permissoes = modulos.flatMap((modulo) =>
        perfis.map((perfil) => ({
          modulo,
          perfil,
          ativo: values[`${modulo}:${perfil}`] ?? true,
        }))
      );
      await persist({ data: { permissoes } });
      toast.success("Permissões salvas");
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const changed = useMemo(() => {
    return Object.keys(values).some((key) => values[key] !== original[key]);
  }, [values, original]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground">
          Administradores sempre possuem acesso completo. Defina os módulos disponíveis para os demais perfis.
        </p>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar alterações
        </button>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground border-b border-border bg-muted/30">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Módulo</th>
              {perfis.map((p) => (
                <th key={p} className="text-center font-medium px-2 py-3">
                  {PERFIL_LABELS[p] ?? p}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {modulos.map((modulo) => (
              <tr key={modulo} className="border-b border-border/40 last:border-0">
                <td className="px-4 py-3 font-medium">{modulo}</td>
                {perfis.map((perfil) => {
                  const key = `${modulo}:${perfil}`;
                  const ativo = values[key] ?? true;
                  const isAdmin = perfil === "admin";
                  return (
                    <td key={perfil} className="text-center px-2 py-3">
                      {isAdmin ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                          <Lock className="h-3.5 w-3.5" /> Completo
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggle(modulo, perfil)}
                          className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors ${
                            ativo ? "bg-primary" : "bg-muted"
                          }`}
                          aria-pressed={ativo}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              ativo ? "translate-x-5" : "translate-x-1"
                            }`}
                          />
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {changed && (
        <p className="text-xs text-muted-foreground">Você tem alterações não salvas.</p>
      )}
    </div>
  );
}
