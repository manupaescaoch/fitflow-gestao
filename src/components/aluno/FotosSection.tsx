import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Camera, Folder, ImageOff, ChevronDown, ChevronRight, Plus, Upload, Loader2, X, GitCompare, Calendar, User, Sparkles, Download, Pencil, Trash2, RefreshCw, Check } from "lucide-react";
import { fmtDateTime } from "@/lib/crm";
import { toast } from "sonner";
import { uploadAnamneseAsset } from "@/lib/anamnese-upload";
import { useSignedAnamneseUrls } from "@/lib/use-signed-anamnese-urls";
import { useServerFn } from "@tanstack/react-start";
import { gerarCheckShapeMensal } from "@/server/check-shape.functions";

interface Props {
  alunoId: string;
}

type SlotKey = "frente" | "costas" | "perfil_esquerdo";

const SLOTS: { key: SlotKey; label: string }[] = [
  { key: "frente", label: "Frente" },
  { key: "costas", label: "Costas" },
  { key: "perfil_esquerdo", label: "Perfil esquerdo" },
];

type Origem = "Anamnese" | "Feedback Mensal" | "Avaliação";

interface Envio {
  id: string;
  data: string | null;
  fotos: Record<SlotKey, string>;
  origem: Origem;
}

const SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 10; // 10 anos

export function FotosSection({ alunoId }: Props) {
  const [loading, setLoading] = useState(true);
  const [envios, setEnvios] = useState<Envio[]>([]);
  const [abertos, setAbertos] = useState<Record<string, boolean>>({});
  const [showModal, setShowModal] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [editandoData, setEditandoData] = useState<string | null>(null);
  const [novaData, setNovaData] = useState<string>("");
  const [salvandoData, setSalvandoData] = useState(false);
  const [excluindo, setExcluindo] = useState<string | null>(null);
  const [trocarFoto, setTrocarFoto] = useState<{ envioId: string; slot: SlotKey } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allUrls = envios.flatMap((e) => [e.fotos.frente, e.fotos.costas, e.fotos.perfil_esquerdo]);
  const { resolve } = useSignedAnamneseUrls(allUrls);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("formularios")
        .select("id, respondido_em, dados_resposta, tipo, origem")
        .eq("aluno_id", alunoId)
        .in("tipo", ["feedback_mensal", "anamnese"])
        .eq("respondido", true)
        .order("respondido_em", { ascending: true });

      const lista: Envio[] = (data ?? [])
        .map((row: any) => {
          const f = row?.dados_resposta?.fotos ?? {};
          const fotos: Record<SlotKey, string> = {
            frente: typeof f.frente === "string" ? f.frente : "",
            costas: typeof f.costas === "string" ? f.costas : "",
            perfil_esquerdo: typeof f.perfil_esquerdo === "string" ? f.perfil_esquerdo : "",
          };
          let origem: Origem;
          if (row.tipo === "anamnese") {
            origem = row.origem === "avaliacao_manual" ? "Avaliação" : "Anamnese";
          } else {
            origem = "Feedback Mensal";
          }
          return { id: row.id, data: row.respondido_em, fotos, origem };
        })
        .filter((e) => e.fotos.frente || e.fotos.costas || e.fotos.perfil_esquerdo);

      if (!cancelado) {
        setEnvios(lista);
        const inicial: Record<string, boolean> = {};
        lista.forEach((e, i) => { inicial[e.id] = i === lista.length - 1; });
        setAbertos(inicial);
        setLoading(false);
      }
    })();
    return () => { cancelado = true; };
  }, [alunoId, reloadKey]);

  function toggle(id: string) {
    setAbertos((s) => ({ ...s, [id]: !s[id] }));
  }

  function iniciarEdicaoData(envio: Envio) {
    setEditandoData(envio.id);
    const iso = envio.data ? new Date(envio.data).toISOString().slice(0, 10) : "";
    setNovaData(iso);
  }

  async function salvarData(envioId: string) {
    if (!novaData) {
      toast.error("Informe uma data");
      return;
    }
    setSalvandoData(true);
    try {
      const respondidoEm = new Date(`${novaData}T12:00:00`).toISOString();
      const { error } = await supabase
        .from("formularios")
        .update({ respondido_em: respondidoEm, recebido_em: respondidoEm })
        .eq("id", envioId);
      if (error) throw new Error(error.message);
      toast.success("Data atualizada");
      setEditandoData(null);
      setReloadKey((k) => k + 1);
    } catch (e: any) {
      toast.error(e.message || "Erro ao atualizar data");
    } finally {
      setSalvandoData(false);
    }
  }

  async function excluirEnvio(envioId: string) {
    if (!confirm("Excluir este envio de fotos? Esta ação não pode ser desfeita.")) return;
    setExcluindo(envioId);
    try {
      const { error } = await supabase.from("formularios").delete().eq("id", envioId);
      if (error) throw new Error(error.message);
      toast.success("Envio excluído");
      setReloadKey((k) => k + 1);
    } catch (e: any) {
      toast.error(e.message || "Erro ao excluir");
    } finally {
      setExcluindo(null);
    }
  }

  async function excluirFoto(envio: Envio, slot: SlotKey) {
    if (!confirm(`Remover a foto "${SLOTS.find((s) => s.key === slot)?.label}"?`)) return;
    try {
      const { data: row, error: selErr } = await supabase
        .from("formularios")
        .select("dados_resposta")
        .eq("id", envio.id)
        .maybeSingle();
      if (selErr) throw new Error(selErr.message);
      const dados = (row?.dados_resposta as any) || {};
      const fotos = { ...(dados.fotos || {}) };
      delete fotos[slot];
      const novosDados = { ...dados, fotos };
      const { error: upErr } = await supabase
        .from("formularios")
        .update({ dados_resposta: novosDados })
        .eq("id", envio.id);
      if (upErr) throw new Error(upErr.message);
      toast.success("Foto removida");
      setReloadKey((k) => k + 1);
    } catch (e: any) {
      toast.error(e.message || "Erro ao remover foto");
    }
  }

  async function handleTrocarFoto(file: File) {
    if (!trocarFoto) return;
    if (file.size > 15 * 1024 * 1024) {
      toast.error("Máximo 15MB");
      return;
    }
    const { envioId, slot } = trocarFoto;
    const slotLabel = SLOTS.find((s) => s.key === slot)?.label || slot;
    const tId = toast.loading(`Enviando nova foto (${slotLabel})…`);
    try {
      const ts = Date.now();
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const named = new File([file], `avaliacao_${ts}_${slot}.${ext}`, {
        type: file.type || "image/jpeg",
      });
      const { url, error } = await uploadAnamneseAsset({
        pathPrefix: `avaliacoes/${alunoId}/`,
        file: named,
      });
      if (error || !url) throw new Error(error || "Falha no upload");

      const { data: row, error: selErr } = await supabase
        .from("formularios")
        .select("dados_resposta")
        .eq("id", envioId)
        .maybeSingle();
      if (selErr) throw new Error(selErr.message);
      const dados = (row?.dados_resposta as any) || {};
      const fotos = { ...(dados.fotos || {}), [slot]: url };
      const novosDados = { ...dados, fotos };
      const { error: upErr } = await supabase
        .from("formularios")
        .update({ dados_resposta: novosDados })
        .eq("id", envioId);
      if (upErr) throw new Error(upErr.message);

      toast.success("Foto trocada", { id: tId });
      setTrocarFoto(null);
      setReloadKey((k) => k + 1);
    } catch (e: any) {
      toast.error(e.message || "Erro ao trocar foto", { id: tId });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera className="h-5 w-5 text-foreground" />
          <h2 className="text-lg font-semibold">Fotos de evolução</h2>
          <span className="text-xs text-muted-foreground">
            ({envios.length} {envios.length === 1 ? "envio" : "envios"})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowCompare(true)}
            disabled={envios.length < 2}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={envios.length < 2 ? "É necessário ter ao menos 2 envios" : "Comparar fotos"}
          >
            <GitCompare className="h-3.5 w-3.5" />
            Comparar
          </button>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 transition-opacity"
          >
            <Plus className="h-3.5 w-3.5" />
            Nova avaliação
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : envios.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center">
          <Camera className="mx-auto h-8 w-8 text-muted-foreground/60" />
          <p className="mt-3 text-sm text-foreground">Nenhuma foto ainda.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Use "Nova avaliação" para subir as fotos, ou aguarde o envio do aluno via Anamnese / Feedback Mensal.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {envios.map((envio) => {
            const aberto = abertos[envio.id] ?? false;
            const editando = editandoData === envio.id;
            return (
              <div key={envio.id} className="rounded-lg border border-border bg-card overflow-hidden">
                <div
                  className={`w-full flex items-center justify-between gap-2 px-4 py-3 bg-muted/30 transition-colors ${aberto ? "border-b border-border" : ""}`}
                >
                  <button
                    type="button"
                    onClick={() => toggle(envio.id)}
                    aria-expanded={aberto}
                    className="flex items-center gap-2 flex-1 text-left hover:opacity-80"
                  >
                    {aberto
                      ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    <Folder className="h-4 w-4 text-primary" />
                    {!editando && (
                      <span className="text-sm font-medium text-foreground">
                        {envio.data ? fmtDateTime(envio.data) : "Sem data"}
                      </span>
                    )}
                  </button>
                  {editando ? (
                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="date"
                        value={novaData}
                        onChange={(e) => setNovaData(e.target.value)}
                        className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => salvarData(envio.id)}
                        disabled={salvandoData}
                        className="inline-flex items-center justify-center rounded-md bg-primary p-1.5 text-primary-foreground hover:opacity-90 disabled:opacity-50"
                        title="Salvar"
                      >
                        {salvandoData ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditandoData(null)}
                        disabled={salvandoData}
                        className="inline-flex items-center justify-center rounded-md border border-border bg-background p-1.5 text-muted-foreground hover:bg-muted"
                        title="Cancelar"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                        {envio.origem}
                      </span>
                      <button
                        type="button"
                        onClick={() => iniciarEdicaoData(envio)}
                        className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        title="Editar data"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => excluirEnvio(envio.id)}
                        disabled={excluindo === envio.id}
                        className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                        title="Excluir envio"
                      >
                        {excluindo === envio.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  )}
                </div>
                {aberto && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4">
                    {SLOTS.map((slot) => (
                      <SlotFoto
                        key={slot.key}
                        url={resolve(envio.fotos[slot.key])}
                        label={slot.label}
                        onTrocar={() => {
                          setTrocarFoto({ envioId: envio.id, slot: slot.key });
                          setTimeout(() => fileInputRef.current?.click(), 0);
                        }}
                        onExcluir={envio.fotos[slot.key] ? () => excluirFoto(envio, slot.key) : undefined}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void handleTrocarFoto(file);
          else setTrocarFoto(null);
        }}
      />

      {showModal && (
        <NovaAvaliacaoModal
          alunoId={alunoId}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); setReloadKey((k) => k + 1); }}
        />
      )}

      {showCompare && (
        <CompararFotosModal
          alunoId={alunoId}
          envios={envios}
          resolve={resolve}
          onClose={() => setShowCompare(false)}
        />
      )}
    </div>
  );
}

function SlotFoto({
  url,
  label,
  onTrocar,
  onExcluir,
}: {
  url: string;
  label: string;
  onTrocar?: () => void;
  onExcluir?: () => void;
}) {
  const ehHeic = /\.heic(\?|$)|\.heif(\?|$)/i.test(url);
  return (
    <div className="space-y-2">
      <div className="aspect-[3/4] w-full overflow-hidden rounded-md border border-border bg-muted relative group">
        {url && !ehHeic ? (
          <>
            <a href={url} target="_blank" rel="noopener noreferrer" className="block h-full w-full">
              <img src={url} alt={label} className="h-full w-full object-cover" />
            </a>
            {(onTrocar || onExcluir) && (
              <div className="absolute top-1.5 right-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {onTrocar && (
                  <button
                    type="button"
                    onClick={onTrocar}
                    className="inline-flex items-center justify-center rounded-md bg-background/90 backdrop-blur p-1.5 text-foreground shadow hover:bg-background"
                    title="Trocar foto"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                )}
                {onExcluir && (
                  <button
                    type="button"
                    onClick={onExcluir}
                    className="inline-flex items-center justify-center rounded-md bg-background/90 backdrop-blur p-1.5 text-destructive shadow hover:bg-background"
                    title="Excluir foto"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}
          </>
        ) : url && ehHeic ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center">
            <ImageOff className="h-8 w-8 text-muted-foreground/60" />
            <p className="text-xs text-muted-foreground">
              Formato HEIC não suportado pelo navegador. Reenvie a foto.
            </p>
            {onTrocar && (
              <button
                type="button"
                onClick={onTrocar}
                className="mt-1 inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground hover:opacity-90"
              >
                <RefreshCw className="h-3 w-3" /> Trocar foto
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={onTrocar}
            disabled={!onTrocar}
            className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted-foreground/60 hover:bg-muted/60 transition-colors disabled:cursor-default"
          >
            {onTrocar ? (
              <>
                <Upload className="h-6 w-6" />
                <span className="text-xs">adicionar foto</span>
              </>
            ) : (
              <>
                <ImageOff className="h-6 w-6" />
                <span className="text-xs">não enviada</span>
              </>
            )}
          </button>
        )}
      </div>
      <p className="text-xs text-center text-muted-foreground">{label}</p>
    </div>
  );
}

function NovaAvaliacaoModal({
  alunoId,
  onClose,
  onSaved,
}: {
  alunoId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [data, setData] = useState(today);
  const [files, setFiles] = useState<Record<SlotKey, File | null>>({
    frente: null,
    costas: null,
    perfil_esquerdo: null,
  });
  const [previews, setPreviews] = useState<Record<SlotKey, string>>({
    frente: "",
    costas: "",
    perfil_esquerdo: "",
  });
  const [saving, setSaving] = useState(false);

  function setFile(slot: SlotKey, file: File | null) {
    if (file && file.size > 15 * 1024 * 1024) {
      toast.error(`${file.name}: máximo 15MB`);
      return;
    }
    setFiles((s) => ({ ...s, [slot]: file }));
    setPreviews((p) => {
      if (p[slot]) URL.revokeObjectURL(p[slot]);
      return { ...p, [slot]: file ? URL.createObjectURL(file) : "" };
    });
  }

  async function handleSave() {
    const algumaFoto = Object.values(files).some((f) => f !== null);
    if (!algumaFoto) {
      toast.error("Selecione ao menos uma foto");
      return;
    }
    if (!data) {
      toast.error("Informe a data da avaliação");
      return;
    }

    setSaving(true);
    try {
      const ts = Date.now();
      const fotosUrls: Record<string, string> = {};
      const falhas: string[] = [];

      for (const slot of SLOTS) {
        const file = files[slot.key];
        if (!file) continue;
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
        const named = new File([file], `avaliacao_${ts}_${slot.key}.${ext}`, {
          type: file.type || "image/jpeg",
        });
        const { url, error } = await uploadAnamneseAsset({
          pathPrefix: `avaliacoes/${alunoId}/`,
          file: named,
        });
        if (error || !url) {
          console.warn(`[avaliacao] falha upload ${slot.key}:`, error);
          falhas.push(slot.label);
          continue;
        }
        fotosUrls[slot.key] = url;
      }

      if (Object.keys(fotosUrls).length === 0) {
        throw new Error(
          falhas.length
            ? `Nenhuma foto foi enviada (${falhas.join(", ")}). Tente novamente.`
            : "Nenhuma foto foi enviada.",
        );
      }

      // grava como formulário tipo "anamnese" com origem="avaliacao_manual"
      // respondido=true e respondido_em=data informada (00:00 local)
      const respondidoEm = new Date(`${data}T12:00:00`).toISOString();

      const { data: inserted, error: insErr } = await supabase
        .from("formularios")
        .insert({
          aluno_id: alunoId,
          tipo: "anamnese",
          origem: "avaliacao_manual",
          respondido: true,
          respondido_em: respondidoEm,
          recebido_em: respondidoEm,
          dados_resposta: { fotos: fotosUrls },
        })
        .select("id")
        .maybeSingle();
      if (insErr) {
        console.error("[avaliacao] INSERT formularios erro:", insErr);
        throw new Error(insErr.message || "Falha ao salvar avaliação");
      }
      if (!inserted?.id) {
        console.error("[avaliacao] INSERT sem retorno (RLS bloqueou?)");
        throw new Error("Sem permissão para salvar a avaliação");
      }
      console.info("[avaliacao] salvo formulario id=", inserted.id, "fotos=", Object.keys(fotosUrls));

      if (falhas.length) {
        toast.warning(`Avaliação salva, mas falharam: ${falhas.join(", ")}. Tente reenviar essas fotos.`);
      } else {
        toast.success("Avaliação salva com sucesso");
      }
      onSaved();
    } catch (e: any) {
      console.error("[avaliacao] erro ao salvar:", e);
      toast.error(e?.message || "Erro ao salvar avaliação");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-lg bg-card border border-border shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h3 className="text-base font-semibold">Nova avaliação fotográfica</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Suba as fotos do aluno (até 15MB cada)</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Data da avaliação</label>
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {SLOTS.map((slot) => (
              <SlotInput
                key={slot.key}
                label={slot.label}
                preview={previews[slot.key]}
                onFile={(f) => setFile(slot.key, f)}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border bg-muted/20">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-md px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {saving ? "Salvando…" : "Salvar avaliação"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SlotInput({
  label,
  preview,
  onFile,
}: {
  label: string;
  preview: string;
  onFile: (f: File | null) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Arquivo deve ser uma imagem");
      return;
    }
    onFile(file);
  }

  return (
    <div className="space-y-2">
      <div
        className={`aspect-[3/4] w-full overflow-hidden rounded-md border-2 border-dashed bg-muted/40 cursor-pointer hover:bg-muted/60 transition-colors relative group ${
          dragOver ? "border-primary bg-primary/10" : "border-border"
        }`}
        onClick={() => ref.current?.click()}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); }}
        onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); }}
        onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); }}
        onDrop={handleDrop}
      >
        {preview ? (
          <>
            <img src={preview} alt={label} className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <span className="text-xs font-medium text-white">Trocar foto</span>
            </div>
          </>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <Upload className="h-6 w-6" />
            <span className="text-xs text-center px-2">
              {dragOver ? "Solte aqui" : "Clique ou arraste"}
            </span>
          </div>
        )}
      </div>
      <p className="text-xs text-center font-medium text-foreground">{label}</p>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}

function CompararFotosModal({
  alunoId,
  envios,
  resolve,
  onClose,
}: {
  alunoId: string;
  envios: Envio[];
  resolve: (url: string) => string;
  onClose: () => void;
}) {
  // ordenado do mais antigo p/ mais novo (envios vem do mais novo)
  const ordenados = [...envios].sort((a, b) => {
    const da = a.data ? new Date(a.data).getTime() : 0;
    const db = b.data ? new Date(b.data).getTime() : 0;
    return da - db;
  });

  const [antesId, setAntesId] = useState<string>(ordenados[0]?.id ?? "");
  const [depoisId, setDepoisId] = useState<string>(ordenados[ordenados.length - 1]?.id ?? "");

  const antes = ordenados.find((e) => e.id === antesId);
  const depois = ordenados.find((e) => e.id === depoisId);

  const exportRef = useRef<HTMLDivElement>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [analiseLoading, setAnaliseLoading] = useState(false);
  const [analise, setAnalise] = useState<string | null>(null);
  const [analiseOpen, setAnaliseOpen] = useState(false);
  const gerarAnaliseFn = useServerFn(gerarCheckShapeMensal);

  async function gerarAnalise() {
    if (!antes || !depois) {
      toast.error("Selecione duas datas para comparar");
      return;
    }
    setAnaliseLoading(true);
    setAnalise(null);
    setAnaliseOpen(true);
    try {
      const r = await gerarAnaliseFn({
        data: {
          alunoId,
          antesFormularioId: antes.id,
          depoisFormularioId: depois.id,
        },
      });
      if (r.error || !r.mensagem) {
        toast.error(r.error || "Não foi possível gerar a análise");
        setAnaliseOpen(false);
      } else {
        setAnalise(r.mensagem);
        toast.success("Análise gerada");
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Falha ao gerar análise");
      setAnaliseOpen(false);
    } finally {
      setAnaliseLoading(false);
    }
  }

  function loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  }

  async function capturar(): Promise<HTMLCanvasElement | null> {
    if (!antes || !depois) return null;
    // Layout: largura 1600, 3 linhas (uma por slot), 2 fotos por linha
    const W = 1600;
    const padding = 40;
    const headerH = 200; // logo + título + subtítulo + pílula período
    const slotTitleH = 50;
    const slotGap = 30;
    const photoGap = 20;
    const photoW = (W - padding * 2 - photoGap) / 2;
    const photoH = Math.round(photoW * 1.33);
    const slotH = slotTitleH + photoH + 20;
    const H = headerH + (slotH + slotGap) * SLOTS.length + padding;

    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;
    // bg
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);

    // ===== Header (igual ao modal): logo + título + subtítulo + pílula período =====
    ctx.textBaseline = "top";
    const logoSize = 60;
    const logoX = padding;
    const logoY = padding;
    // tenta carregar a logo MP; se falhar, desenha um placeholder vermelho com "M"
    try {
      const logo = await loadImage("/mp-logo.png");
      // arredondamento simulado por clip
      const r = 10;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(logoX + r, logoY);
      ctx.lineTo(logoX + logoSize - r, logoY);
      ctx.quadraticCurveTo(logoX + logoSize, logoY, logoX + logoSize, logoY + r);
      ctx.lineTo(logoX + logoSize, logoY + logoSize - r);
      ctx.quadraticCurveTo(logoX + logoSize, logoY + logoSize, logoX + logoSize - r, logoY + logoSize);
      ctx.lineTo(logoX + r, logoY + logoSize);
      ctx.quadraticCurveTo(logoX, logoY + logoSize, logoX, logoY + logoSize - r);
      ctx.lineTo(logoX, logoY + r);
      ctx.quadraticCurveTo(logoX, logoY, logoX + r, logoY);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(logo, logoX, logoY, logoSize, logoSize);
      ctx.restore();
    } catch {
      ctx.fillStyle = "#dc2626";
      ctx.fillRect(logoX, logoY, logoSize, logoSize);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 32px system-ui, -apple-system, sans-serif";
      ctx.fillText("M", logoX + 18, logoY + 12);
    }

    const textX = logoX + logoSize + 18;
    // título
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 34px system-ui, -apple-system, sans-serif";
    ctx.fillText("Comparar fotos de evolução", textX, logoY + 2);
    // subtítulo
    ctx.fillStyle = "#64748b";
    ctx.font = "18px system-ui, -apple-system, sans-serif";
    ctx.fillText("Selecione duas datas para comparar lado a lado", textX, logoY + 44);

    // pílula de período
    const pillY = logoY + logoSize + 24;
    const pillH = 38;
    const pillPadX = 16;
    ctx.font = "16px system-ui, -apple-system, sans-serif";
    const dataAntes = fmtData(antes.data);
    const dataDepois = fmtData(depois.data);
    const periodo = periodoLabel();
    const pillText = `📅  ${dataAntes}  até  ${dataDepois}  •  Período analisado: ${periodo}`;
    const pillW = ctx.measureText(pillText).width + pillPadX * 2;
    // fundo arredondado (cinza claro)
    const pillX = padding;
    const pr = pillH / 2;
    ctx.fillStyle = "#f1f5f9";
    ctx.beginPath();
    ctx.moveTo(pillX + pr, pillY);
    ctx.lineTo(pillX + pillW - pr, pillY);
    ctx.quadraticCurveTo(pillX + pillW, pillY, pillX + pillW, pillY + pr);
    ctx.quadraticCurveTo(pillX + pillW, pillY + pillH, pillX + pillW - pr, pillY + pillH);
    ctx.lineTo(pillX + pr, pillY + pillH);
    ctx.quadraticCurveTo(pillX, pillY + pillH, pillX, pillY + pr);
    ctx.quadraticCurveTo(pillX, pillY, pillX + pr, pillY);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#475569";
    ctx.fillText(pillText, pillX + pillPadX, pillY + (pillH - 16) / 2 - 1);

    // slots
    for (let i = 0; i < SLOTS.length; i++) {
      const slot = SLOTS[i];
      const yBase = headerH + i * (slotH + slotGap);
      // título
      ctx.fillStyle = "#64748b";
      ctx.font = "bold 18px system-ui, -apple-system, sans-serif";
      const title = slot.label.toUpperCase();
      const titleW = ctx.measureText(title).width;
      ctx.fillText(title, (W - titleW) / 2, yBase);

      const yPhoto = yBase + slotTitleH;
      const items = [
        { url: resolve(antes.fotos[slot.key]), legenda: fmtData(antes.data), chip: "Antes", x: padding },
        { url: resolve(depois.fotos[slot.key]), legenda: fmtData(depois.data), chip: "Depois", x: padding + photoW + photoGap },
      ];
      for (const it of items) {
        // moldura
        ctx.fillStyle = "#f1f5f9";
        ctx.fillRect(it.x, yPhoto, photoW, photoH);
        if (it.url) {
          try {
            const img = await loadImage(it.url);
            // contain
            const ratio = Math.min(photoW / img.width, photoH / img.height);
            const dw = img.width * ratio;
            const dh = img.height * ratio;
            const dx = it.x + (photoW - dw) / 2;
            const dy = yPhoto + (photoH - dh) / 2;
            ctx.drawImage(img, dx, dy, dw, dh);
          } catch (e) {
            console.error("Falha ao carregar foto", it.url, e);
            ctx.fillStyle = "#94a3b8";
            ctx.font = "16px system-ui";
            ctx.fillText("Imagem indisponível", it.x + 20, yPhoto + 20);
          }
        }
        // chip
        ctx.fillStyle = it.chip === "Antes" ? "rgba(255,255,255,0.95)" : "rgba(187,247,208,0.95)";
        const chipPad = 10;
        ctx.font = "bold 16px system-ui";
        const chipW = ctx.measureText(it.chip).width + chipPad * 2;
        const chipH = 30;
        const chipX = it.x + 12;
        const chipY = yPhoto + photoH - chipH - 12;
        ctx.fillRect(chipX, chipY, chipW, chipH);
        ctx.fillStyle = it.chip === "Antes" ? "#0f172a" : "#065f46";
        ctx.fillText(it.chip, chipX + chipPad, chipY + 7);
        // data badge
        ctx.fillStyle = "rgba(0,0,0,0.65)";
        const dateW = ctx.measureText(it.legenda).width + chipPad * 2;
        const dateX = chipX + chipW + 8;
        ctx.fillRect(dateX, chipY, dateW, chipH);
        ctx.fillStyle = "#ffffff";
        ctx.fillText(it.legenda, dateX + chipPad, chipY + 7);
      }
    }

    return canvas;
  }

  async function exportarPNG() {
    try {
      setExporting(true);
      const canvas = await capturar();
      if (!canvas) return;
      const link = document.createElement("a");
      link.download = `comparacao-${fmtData(antes?.data ?? null)}-${fmtData(depois?.data ?? null)}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("PNG exportado");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao exportar PNG");
    } finally {
      setExporting(false);
      setExportOpen(false);
    }
  }

  async function exportarPDF() {
    try {
      setExporting(true);
      const canvas = await capturar();
      if (!canvas) return;
      const { jsPDF } = await import("jspdf");
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? "landscape" : "portrait",
        unit: "px",
        format: [canvas.width, canvas.height],
      });
      pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
      pdf.save(`comparacao-${fmtData(antes?.data ?? null)}-${fmtData(depois?.data ?? null)}.pdf`);
      toast.success("PDF exportado");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao exportar PDF");
    } finally {
      setExporting(false);
      setExportOpen(false);
    }
  }

  function fmtData(iso: string | null) {
    if (!iso) return "Sem data";
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR");
  }

  function periodoLabel(): string {
    if (!antes?.data || !depois?.data) return "";
    const a = new Date(antes.data);
    const b = new Date(depois.data);
    let ms = b.getTime() - a.getTime();
    if (ms < 0) ms = -ms;
    const dias = Math.floor(ms / 86400000);
    const anos = Math.floor(dias / 365);
    const restoApos = dias - anos * 365;
    const meses = Math.floor(restoApos / 30);
    const diasRest = restoApos - meses * 30;
    const partes: string[] = [];
    if (anos) partes.push(`${anos} ${anos === 1 ? "ano" : "anos"}`);
    if (meses) partes.push(`${meses} ${meses === 1 ? "mês" : "meses"}`);
    if (diasRest) partes.push(`${diasRest} ${diasRest === 1 ? "dia" : "dias"}`);
    return partes.length ? partes.join(", ").replace(/, ([^,]*)$/, " e $1") : "0 dias";
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-2xl bg-card border border-border shadow-2xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div ref={exportRef} className="bg-card">
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4">
          <div className="flex items-start gap-3">
            <img src="/mp-logo.png" alt="MP" className="h-10 w-10 rounded-md" />
            <div>
              <h3 className="text-xl font-semibold leading-tight">Comparar fotos de evolução</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                Selecione duas datas para comparar lado a lado
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-muted-foreground hover:bg-muted"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Faixa de período */}
        {antes && depois && (
          <div className="px-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-muted/60 px-3 py-1.5 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span className="font-medium text-foreground">{fmtData(antes.data)}</span>
              <span>até</span>
              <span className="font-medium text-foreground">{fmtData(depois.data)}</span>
              <span className="text-muted-foreground/60">•</span>
              <span>Período analisado: {periodoLabel()}</span>
            </div>
          </div>
        )}

        {/* Dropdowns */}
        <div className="px-6 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <SeletorData
              titulo="ANTES"
              value={antesId}
              onChange={setAntesId}
              options={ordenados}
              fmtData={fmtData}
            />
            <SeletorData
              titulo="DEPOIS"
              value={depoisId}
              onChange={setDepoisId}
              options={ordenados}
              fmtData={fmtData}
            />
          </div>
        </div>

        {/* Comparações por slot */}
        {antes && depois && (
          <div className="px-6 pt-4 space-y-4">
            {SLOTS.map((slot) => {
              const urlA = resolve(antes.fotos[slot.key]);
              const urlB = resolve(depois.fotos[slot.key]);
              return (
                <div key={slot.key} className="rounded-xl border border-border bg-background p-4">
                  <div className="flex items-center justify-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-[0.15em] mb-3">
                    <User className="h-3.5 w-3.5" />
                    {slot.label}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <FotoComparada url={urlA} legenda={fmtData(antes.data)} chip="Antes" />
                    <FotoComparada url={urlB} legenda={fmtData(depois.data)} chip="Depois" />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-5 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            Fechar
          </button>
          <button
            type="button"
            onClick={gerarAnalise}
            disabled={analiseLoading || !antes || !depois}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-60"
          >
            {analiseLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {analiseLoading ? "Gerando…" : "Gerar análise"}
          </button>
          <div className="relative">
            <button
              type="button"
              disabled={exporting || !antes || !depois}
              onClick={() => setExportOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Exportar comparação
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {exportOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setExportOpen(false)} />
                <div className="absolute right-0 bottom-full mb-2 z-20 w-44 rounded-md border border-border bg-popover shadow-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={exportarPDF}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                  >
                    Exportar como PDF
                  </button>
                  <button
                    type="button"
                    onClick={exportarPNG}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                  >
                    Exportar como PNG
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {analiseOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
          onClick={(e) => { e.stopPropagation(); setAnaliseOpen(false); }}
        >
          <div
            className="w-full max-w-2xl rounded-2xl bg-card border border-border shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-100 text-emerald-700">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold leading-tight">Análise — Check Shape Mensal</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {antes && depois ? `${fmtData(antes.data)} → ${fmtData(depois.data)} • ${periodoLabel()}` : ""}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAnaliseOpen(false)}
                className="rounded-full p-2 text-muted-foreground hover:bg-muted"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-6 py-5">
              {analiseLoading ? (
                <div className="flex flex-col items-center justify-center gap-3 py-10 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
                  <p className="text-sm">Analisando as fotos com a IA…</p>
                  <p className="text-xs">Isso pode levar alguns segundos.</p>
                </div>
              ) : analise ? (
                <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                  {analise}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma resposta gerada.</p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
              {analise && (
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(analise);
                    toast.success("Resposta copiada");
                  }}
                  className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                >
                  Copiar
                </button>
              )}
              <button
                type="button"
                onClick={() => setAnaliseOpen(false)}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SeletorData({
  titulo,
  value,
  onChange,
  options,
  fmtData,
}: {
  titulo: string;
  value: string;
  onChange: (v: string) => void;
  options: Envio[];
  fmtData: (iso: string | null) => string;
}) {
  const sel = options.find((o) => o.id === value);
  return (
    <div className="rounded-xl border border-border bg-background px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <Calendar className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            {titulo}
          </div>
          <div className="relative">
            <select
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="w-full appearance-none bg-transparent pr-6 text-sm font-medium text-foreground focus:outline-none"
            >
              {options.map((e) => (
                <option key={e.id} value={e.id}>
                  {fmtData(e.data)} — {e.origem}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          </div>
        </div>
      </div>
      {sel ? null : null}
    </div>
  );
}

function FotoComparada({ url, legenda, chip }: { url: string; legenda: string; chip: string }) {
  const isAntes = chip === "Antes";
  return (
    <div className="relative aspect-[4/5] w-full overflow-hidden rounded-lg border border-border bg-muted">
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="block h-full w-full">
          <img src={url} alt={chip} className="h-full w-full object-cover hover:opacity-95 transition-opacity" />
        </a>
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted-foreground/60">
          <ImageOff className="h-6 w-6" />
          <span className="text-xs">não enviada</span>
        </div>
      )}
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
        <span
          className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${
            isAntes ? "bg-white text-foreground" : "bg-emerald-200 text-emerald-900"
          }`}
        >
          {chip}
        </span>
        <span className="text-[11px] font-medium text-white px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm">
          {legenda}
        </span>
      </div>
    </div>
  );
}
