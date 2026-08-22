import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Save } from "lucide-react";

interface Config {
  id: string;
  dias_alerta_vencimento: number;
  mensagem_cobranca: string;
  juros_pct: number;
  multa_pct: number;
}

interface Props { isAdmin: boolean }

export function ConfiguracoesTab({ isAdmin }: Props) {
  const [cfg, setCfg] = useState<Config | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void supabase.from("financeiro_config").select("*").limit(1).maybeSingle()
      .then(({ data }) => { if (data) setCfg(data as Config); });
  }, []);

  async function salvar() {
    if (!cfg) return;
    setSaving(true);
    const { error } = await supabase.from("financeiro_config")
      .update({
        dias_alerta_vencimento: cfg.dias_alerta_vencimento,
        mensagem_cobranca: cfg.mensagem_cobranca,
        juros_pct: cfg.juros_pct,
        multa_pct: cfg.multa_pct,
      })
      .eq("id", cfg.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Configurações salvas");
  }

  if (!cfg) return <p className="fin-muted text-sm">Carregando…</p>;

  const disabled = !isAdmin;

  return (
    <div className="fin-card max-w-2xl space-y-4">
      <div>
        <h3 className="font-semibold">Regras de cobrança</h3>
        <p className="text-xs fin-muted">{disabled ? "Apenas administradores podem alterar." : "Defina alertas e taxas de cobrança."}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium">Dias antes do vencimento (alerta)</label>
          <input type="number" min={0} max={30} value={cfg.dias_alerta_vencimento}
            onChange={(e) => setCfg({ ...cfg, dias_alerta_vencimento: Number(e.target.value) })}
            disabled={disabled} className="w-full h-9 px-3 rounded-lg text-sm" />
        </div>
        <div />
        <div className="space-y-1">
          <label className="text-xs font-medium">Juros (% ao mês)</label>
          <input type="number" step="0.1" value={cfg.juros_pct}
            onChange={(e) => setCfg({ ...cfg, juros_pct: Number(e.target.value) })}
            disabled={disabled} className="w-full h-9 px-3 rounded-lg text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Multa (%)</label>
          <input type="number" step="0.1" value={cfg.multa_pct}
            onChange={(e) => setCfg({ ...cfg, multa_pct: Number(e.target.value) })}
            disabled={disabled} className="w-full h-9 px-3 rounded-lg text-sm" />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium">Mensagem padrão de cobrança</label>
        <textarea rows={4} value={cfg.mensagem_cobranca}
          onChange={(e) => setCfg({ ...cfg, mensagem_cobranca: e.target.value })}
          disabled={disabled} className="w-full px-3 py-2 rounded-lg text-sm" />
        <p className="text-[11px] fin-muted">Variáveis: {"{{nome}}"}, {"{{dias}}"}</p>
      </div>

      {isAdmin && (
        <button onClick={salvar} disabled={saving}
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: "var(--text)" }}>
          <Save className="h-3.5 w-3.5" /> {saving ? "Salvando…" : "Salvar"}
        </button>
      )}
    </div>
  );
}