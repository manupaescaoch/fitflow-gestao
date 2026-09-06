import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useBranding, recarregarBranding, LOGO_PADRAO } from "@/hooks/useBranding";
import { aplicarCorSistema, COR_PADRAO } from "@/lib/tema";
import { Loader2, Save, Upload, Trash2, Palette } from "lucide-react";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB no arquivo enviado
const CORES_SUGERIDAS = ["#2563EB", "#0F172A", "#DC2626", "#EA580C", "#16A34A", "#7C3AED", "#DB2777", "#0891B2"];
const MAX_LADO = 512; // a logo é reduzida para no máximo 512px

// Reduz a imagem no navegador para que ela caiba sempre no sistema.
function prepararLogo(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.type === "image/svg+xml") {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(new Error("Não foi possível ler a imagem"));
      r.readAsDataURL(file);
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const escala = Math.min(1, MAX_LADO / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * escala));
      const h = Math.max(1, Math.round(img.height * escala));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Não foi possível processar a imagem"));
      ctx.drawImage(img, 0, 0, w, h);
      let out = canvas.toDataURL("image/webp", 0.9);
      if (out.length > 400 * 1024) out = canvas.toDataURL("image/webp", 0.7);
      if (!out.startsWith("data:image/webp")) out = canvas.toDataURL("image/png");
      resolve(out);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível ler a imagem"));
    };
    img.src = url;
  });
}

export function PersonalizarSection() {
  const atual = useBranding();
  const inputRef = useRef<HTMLInputElement>(null);

  const [nome, setNome] = useState(atual.nome);
  const [subtitulo, setSubtitulo] = useState(atual.subtitulo);
  const [logo, setLogo] = useState<string | null>(atual.logo_url);
  const [cor, setCor] = useState(atual.cor_primaria);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setNome(atual.nome);
    setSubtitulo(atual.subtitulo);
    setLogo(atual.logo_url);
    setCor(atual.cor_primaria);
  }, [atual.nome, atual.subtitulo, atual.logo_url, atual.cor_primaria]);

  // pré-visualiza a cor na hora e volta ao salvo se sair sem salvar
  useEffect(() => {
    aplicarCorSistema(cor);
    return () => aplicarCorSistema(atual.cor_primaria);
  }, [cor, atual.cor_primaria]);

  const dirty = nome !== atual.nome || subtitulo !== atual.subtitulo || logo !== atual.logo_url || cor !== atual.cor_primaria;

  const escolherArquivo = async (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Envie um arquivo de imagem");
    if (file.size > MAX_BYTES) return toast.error("A imagem deve ter no máximo 10 MB");
    try {
      const dataUrl = await prepararLogo(file);
      setLogo(dataUrl);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível ler a imagem");
    }
  };


  const salvar = async () => {
    const nomeLimpo = nome.trim();
    if (!nomeLimpo) return toast.error("Informe o nome do sistema");
    if (nomeLimpo.length > 40) return toast.error("O nome deve ter até 40 caracteres");
    if (subtitulo.trim().length > 20) return toast.error("O subtítulo deve ter até 20 caracteres");

    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("app_branding")
        .update({ nome: nomeLimpo, subtitulo: subtitulo.trim(), logo_url: logo, cor_primaria: cor })
        .eq("id", true);
      if (error) throw new Error(error.message);
      await recarregarBranding();
      toast.success("Personalização salva");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-start gap-2 border-b border-border px-5 py-4">
        <Palette className="mt-0.5 h-4 w-4 text-primary" />
        <div>
          <h2 className="font-semibold">Identidade do sistema</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Altere o nome e a logo que aparecem no menu e no topo do sistema.
          </p>
        </div>
      </div>

      <div className="grid gap-6 p-5 md:grid-cols-2">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Nome do sistema</label>
            <input
              value={nome}
              maxLength={40}
              onChange={(e) => setNome(e.target.value)}
              placeholder="MPTEAM"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Subtítulo</label>
            <input
              value={subtitulo}
              maxLength={20}
              onChange={(e) => setSubtitulo(e.target.value)}
              placeholder="CRM"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Cor do sistema</label>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                type="color"
                value={cor}
                onChange={(e) => setCor(e.target.value)}
                className="h-9 w-12 cursor-pointer rounded-md border border-input bg-background p-1"
                aria-label="Escolher a cor do sistema"
              />
              <input
                value={cor}
                onChange={(e) => setCor(e.target.value)}
                maxLength={7}
                className="w-28 rounded-md border border-input bg-background px-3 py-2 text-sm uppercase"
              />
              {CORES_SUGERIDAS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCor(c)}
                  style={{ backgroundColor: c }}
                  aria-label={`Usar a cor ${c}`}
                  className="h-7 w-7 rounded-full border border-border"
                />
              ))}
              {cor.toLowerCase() !== COR_PADRAO.toLowerCase() && (
                <button
                  type="button"
                  onClick={() => setCor(COR_PADRAO)}
                  className="rounded-md border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
                >
                  Cor padrão
                </button>
              )}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              O fundo continua branco; muda apenas o que hoje é azul (botões, menu ativo, destaques).
            </p>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Logo</label>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                ref={inputRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                className="hidden"
                onChange={(e) => escolherArquivo(e.target.files?.[0])}
              />
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:bg-muted"
              >
                <Upload className="h-3.5 w-3.5" /> Enviar imagem
              </button>
              {logo && (
                <button
                  type="button"
                  onClick={() => setLogo(null)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Usar logo padrão
                </button>
              )}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              PNG, JPG, SVG ou WebP, de até 10 MB. A imagem é ajustada automaticamente.
            </p>
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-muted-foreground">Pré-visualização</p>
          <div className="mt-2 rounded-lg border border-border bg-sidebar p-5">
            <div className="flex items-center gap-2.5">
              <img src={logo || LOGO_PADRAO} alt="Logo" className="h-8 w-8 rounded object-contain" />
              <div>
                <div className="text-[15px] font-black leading-none tracking-tight text-foreground">
                  {nome || "MPTEAM"}
                </div>
                <div className="mt-1 text-[9px] font-medium tracking-[0.3em] text-muted-foreground">
                  {subtitulo || ""}
                </div>
              </div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">Botão principal</span>
            <span className="inline-flex items-center rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground">Item ativo</span>
          </div>
        </div>
      </div>

      <div className="flex justify-end border-t border-border px-5 py-4">
        <button
          onClick={salvar}
          disabled={!dirty || saving}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar personalização
        </button>
      </div>
    </div>
  );
}
