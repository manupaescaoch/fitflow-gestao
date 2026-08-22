import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  getRoteamentoConfig, saveRoteamentoConfig, previewRoteamento, testarRoteamento,
} from "@/server/roteamento-grupos.functions";
import { type ZapiGroup } from "@/server/zapi.functions";
import {
  CheckCircle2, XCircle, Loader2, RefreshCw, Save, X, Send, Eye, Users, MessageCircle,
  ShieldAlert,
} from "lucide-react";

type Cfg = { ativo: boolean; destinoTipo: "telefone" | "grupo"; destinoValor: string };
type Bucket = "feedbacks_fu" | "respostas_ia";

export function RoteamentoGrupoCard({
  bucket,
  titulo,
  descricao,
  zapiConfigurado,
  groups,
  groupsLoading,
  groupsError,
  onLoadGroups,
}: {
  bucket: Bucket;
  titulo: string;
  descricao: string;
  zapiConfigurado: boolean;
  groups: ZapiGroup[] | null;
  groupsLoading: boolean;
  groupsError: string | null;
  onLoadGroups: () => void;
}) {
  const fetchCfg = useServerFn(getRoteamentoConfig);
  const persistCfg = useServerFn(saveRoteamentoConfig);
  const previewCfg = useServerFn(previewRoteamento);
  const testCfg = useServerFn(testarRoteamento);

  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [draft, setDraft] = useState<Cfg>({ ativo: false, destinoTipo: "grupo", destinoValor: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const c = await fetchCfg({ data: { bucket } });
      const next: Cfg = { ativo: c.ativo, destinoTipo: c.destinoTipo, destinoValor: c.destinoValor };
      setCfg(next);
      setDraft(next);
    } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [bucket]);

  const dirty = !!cfg && (
    draft.ativo !== cfg.ativo ||
    draft.destinoTipo !== cfg.destinoTipo ||
    draft.destinoValor.trim() !== cfg.destinoValor.trim()
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      await persistCfg({ data: { bucket, ...draft, destinoValor: draft.destinoValor.trim() } });
      toast.success("Configuração salva");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar");
    } finally { setSaving(false); }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const r = await testCfg({ data: { bucket } });
      if (r.ok) toast.success("Mensagem enviada");
      else toast.error(r.error);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no envio");
    } finally { setTesting(false); }
  };

  const handlePreview = async () => {
    setPreviewing(true);
    try {
      const r = await previewCfg({ data: { bucket } });
      setPreview(r.mensagem);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao gerar prévia");
    } finally { setPreviewing(false); }
  };

  const radioName = `roteamento-${bucket}`;

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-primary" />
          <div>
            <h2 className="font-semibold">{titulo}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{descricao}</p>
          </div>
        </div>
        <button onClick={load} disabled={loading}
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Recarregar
        </button>
      </div>
      <div className="px-5 py-3 border-b border-border bg-amber-500/10 flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400">
        <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
        <div>
          <strong>Bloqueado por segurança.</strong> Feedbacks, follow-ups, respostas de anamnese e devolutivas de IA
          sempre vão direto para o WhatsApp do aluno. O redirecionamento para grupo está desativado no motor de envio
          e não pode ser reativado por esta tela.
        </div>
      </div>
      {loading && !cfg ? (
        <div className="px-5 py-8 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
        </div>
      ) : (
        <div className="px-5 py-5 space-y-4">
          <label className="flex items-center gap-3 text-sm font-medium opacity-60 cursor-not-allowed">
            <input
              type="checkbox"
              checked={false}
              disabled
              className="h-4 w-4 rounded border-input"
            />
            <span>Ativar redirecionamento para grupo</span>
            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              <XCircle className="h-3 w-3" /> Desativado permanentemente
            </span>
          </label>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Tipo de destino</label>
            <div className="flex gap-4 pt-1">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name={radioName}
                  checked={draft.destinoTipo === "telefone"}
                  onChange={() => setDraft((d) => ({ ...d, destinoTipo: "telefone" }))}
                />
                Telefone
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name={radioName}
                  checked={draft.destinoTipo === "grupo"}
                  onChange={() => setDraft((d) => ({ ...d, destinoTipo: "grupo" }))}
                />
                Grupo
              </label>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              {draft.destinoTipo === "telefone" ? "Número (com DDI)" : "ID do grupo do WhatsApp"}
            </label>
            <input
              type="text"
              value={draft.destinoValor}
              onChange={(e) => setDraft((d) => ({ ...d, destinoValor: e.target.value }))}
              placeholder={draft.destinoTipo === "telefone" ? "5511999999999" : "120363012345678901@g.us"}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
            />
            {draft.destinoTipo === "grupo" && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onLoadGroups}
                    disabled={groupsLoading || !zapiConfigurado}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
                  >
                    {groupsLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Users className="h-3.5 w-3.5" />}
                    {groups ? "Recarregar grupos" : "Buscar grupos do WhatsApp"}
                  </button>
                  {groups && <span className="text-xs text-muted-foreground">{groups.length} grupo{groups.length === 1 ? "" : "s"} encontrado{groups.length === 1 ? "" : "s"}</span>}
                </div>
                {groups && groups.length > 0 && (
                  <select
                    value={groups.some((g) => g.id === draft.destinoValor) ? draft.destinoValor : ""}
                    onChange={(e) => setDraft((d) => ({ ...d, destinoValor: e.target.value }))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">— Selecione um grupo —</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>{g.name} ({g.id})</option>
                    ))}
                  </select>
                )}
                {groupsError && <p className="text-xs text-destructive">{groupsError}</p>}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Quando ativo, todas as mensagens deste tipo passam a sair para o destino acima, com{" "}
              <strong>nome do aluno, telefone</strong> e a <strong>mensagem original</strong> no corpo.
            </p>
          </div>

          {preview && (
            <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">Prévia do corpo enviado</span>
                <button onClick={() => setPreview(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <pre className="whitespace-pre-wrap text-xs text-foreground">{preview}</pre>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border">
            <div className="flex items-center gap-2">
              <button
                onClick={handlePreview}
                disabled={previewing || true}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
              >
                {previewing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                Pré-visualizar
              </button>
              <button
                onClick={handleTest}
                disabled
                title="Roteamento para grupo desativado permanentemente"
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
              >
                {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Testar envio
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSave}
                disabled
                title="Roteamento para grupo desativado permanentemente"
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                {saving ? "Salvando..." : "Salvar configuração"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}