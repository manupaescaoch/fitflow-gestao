import { useEffect, useState } from "react";
import { Loader2, Download, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSignedAnamneseUrls } from "@/lib/use-signed-anamnese-urls";
import { toast } from "sonner";

type SlotKey = "frente" | "costas" | "perfil_esquerdo";
const SLOTS: { key: SlotKey; label: string }[] = [
  { key: "frente", label: "Frente" },
  { key: "costas", label: "Costas" },
  { key: "perfil_esquerdo", label: "Perfil" },
];

type Envio = { id: string; data: string; fotos: Record<SlotKey, string> };

function fmt(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
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

export function FotosEvolucaoCard({ alunoId, alunoNome }: { alunoId: string; alunoNome?: string }) {
  const [envios, setEnvios] = useState<Envio[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("formularios")
        .select("id, respondido_em, dados_resposta")
        .eq("aluno_id", alunoId)
        .in("tipo", ["feedback_mensal", "anamnese"])
        .eq("respondido", true)
        .order("respondido_em", { ascending: true });
      const lista: Envio[] = ((data as any[]) ?? [])
        .map((row) => {
          const f = row?.dados_resposta?.fotos ?? {};
          return {
            id: row.id,
            data: row.respondido_em,
            fotos: {
              frente: typeof f.frente === "string" ? f.frente : "",
              costas: typeof f.costas === "string" ? f.costas : "",
              perfil_esquerdo: typeof f.perfil_esquerdo === "string" ? f.perfil_esquerdo : "",
            },
          };
        })
        .filter((e) => e.fotos.frente || e.fotos.costas || e.fotos.perfil_esquerdo);
      if (!cancelled) {
        setEnvios(lista);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [alunoId]);

  const antes = envios[0] ?? null;
  const depois = envios.length > 1 ? envios[envios.length - 1] : null;

  const allUrls = envios.flatMap((e) => [e.fotos.frente, e.fotos.costas, e.fotos.perfil_esquerdo]).filter(Boolean);
  const { resolve } = useSignedAnamneseUrls(allUrls);

  async function exportarPNG() {
    if (!antes || !depois) return;
    setExporting(true);
    try {
      const W = 1080;
      const H = 1920; // formato story Instagram
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d")!;

      // Fundo gradiente vermelho-preto
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, "#0a0a0a");
      grad.addColorStop(1, "#1a0405");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // Logo MP
      const logoSize = 90;
      const logoX = (W - logoSize) / 2;
      const logoY = 80;
      try {
        const logo = await loadImage("/mp-logo.png");
        ctx.drawImage(logo, logoX, logoY, logoSize, logoSize);
      } catch {
        ctx.fillStyle = "#F70906";
        ctx.fillRect(logoX, logoY, logoSize, logoSize);
      }

      // Título
      ctx.textAlign = "center";
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 56px system-ui, -apple-system, sans-serif";
      ctx.fillText("MINHA EVOLUÇÃO", W / 2, logoY + logoSize + 70);

      ctx.fillStyle = "#F70906";
      ctx.font = "bold 28px system-ui, -apple-system, sans-serif";
      ctx.fillText("MPTEAM • TRANSFORMAÇÃO REAL", W / 2, logoY + logoSize + 110);

      if (alunoNome) {
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.font = "500 24px system-ui, -apple-system, sans-serif";
        ctx.fillText(alunoNome.toUpperCase(), W / 2, logoY + logoSize + 150);
      }

      // Layout fotos: 3 linhas (slots), 2 colunas (antes/depois)
      const headerH = logoY + logoSize + 200;
      const padding = 40;
      const photoGap = 20;
      const photoW = (W - padding * 2 - photoGap) / 2;
      const slotTitleH = 50;
      const slotGap = 30;
      const footerH = 180;
      const availableH = H - headerH - footerH;
      const photoH = (availableH - SLOTS.length * slotTitleH - (SLOTS.length - 1) * slotGap) / SLOTS.length;

      for (let i = 0; i < SLOTS.length; i++) {
        const slot = SLOTS[i];
        const yBase = headerH + i * (slotTitleH + photoH + slotGap);

        // Título do slot
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.font = "bold 22px system-ui, -apple-system, sans-serif";
        ctx.fillText(slot.label.toUpperCase(), W / 2, yBase);

        const yPhoto = yBase + slotTitleH;
        const items = [
          { url: resolve(antes.fotos[slot.key]), legenda: fmt(antes.data), chip: "ANTES", x: padding },
          { url: resolve(depois.fotos[slot.key]), legenda: fmt(depois.data), chip: "AGORA", x: padding + photoW + photoGap },
        ];
        for (const it of items) {
          ctx.fillStyle = "#1a1a1a";
          ctx.fillRect(it.x, yPhoto, photoW, photoH);
          if (it.url) {
            try {
              const img = await loadImage(it.url);
              const ratio = Math.max(photoW / img.width, photoH / img.height);
              const dw = img.width * ratio;
              const dh = img.height * ratio;
              const dx = it.x + (photoW - dw) / 2;
              const dy = yPhoto + (photoH - dh) / 2;
              ctx.save();
              ctx.beginPath();
              ctx.rect(it.x, yPhoto, photoW, photoH);
              ctx.clip();
              ctx.drawImage(img, dx, dy, dw, dh);
              ctx.restore();
            } catch {
              ctx.fillStyle = "rgba(255,255,255,0.4)";
              ctx.font = "18px system-ui";
              ctx.fillText("Imagem indisponível", it.x + photoW / 2, yPhoto + photoH / 2);
            }
          }
          // Chip ANTES/AGORA
          ctx.textAlign = "left";
          const chipPad = 14;
          ctx.font = "bold 20px system-ui";
          const chipW = ctx.measureText(it.chip).width + chipPad * 2;
          const chipH = 36;
          const chipX = it.x + 12;
          const chipY = yPhoto + 12;
          ctx.fillStyle = it.chip === "ANTES" ? "rgba(255,255,255,0.95)" : "#F70906";
          ctx.fillRect(chipX, chipY, chipW, chipH);
          ctx.fillStyle = it.chip === "ANTES" ? "#0a0a0a" : "#ffffff";
          ctx.textBaseline = "middle";
          ctx.fillText(it.chip, chipX + chipPad, chipY + chipH / 2);
          // Data badge
          ctx.fillStyle = "rgba(0,0,0,0.7)";
          ctx.font = "600 18px system-ui";
          const dataW = ctx.measureText(it.legenda).width + chipPad * 2;
          const dataX = it.x + photoW - dataW - 12;
          const dataY = yPhoto + photoH - chipH - 12;
          ctx.fillRect(dataX, dataY, dataW, chipH);
          ctx.fillStyle = "#ffffff";
          ctx.fillText(it.legenda, dataX + chipPad, dataY + chipH / 2);
          ctx.textBaseline = "alphabetic";
        }
      }

      // Footer
      ctx.textAlign = "center";
      ctx.fillStyle = "#F70906";
      ctx.font = "bold 32px system-ui";
      ctx.fillText("@mpteambr", W / 2, H - 90);
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "500 22px system-ui";
      ctx.fillText("mpteambr.com  •  consistência > motivação", W / 2, H - 50);

      const link = document.createElement("a");
      link.download = `evolucao-mpteam-${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("Imagem salva! Pronto pra postar 🔥");
    } catch (e: any) {
      toast.error("Falha ao gerar imagem: " + (e?.message || ""));
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl bg-zinc-50 border border-dashed border-zinc-200 p-6 flex items-center justify-center text-[12px] text-zinc-500">
        <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Carregando fotos…
      </div>
    );
  }

  if (envios.length === 0) {
    return (
      <div className="rounded-2xl bg-zinc-50 border border-dashed border-zinc-200 p-6 text-center">
        <ImageIcon className="h-5 w-5 text-zinc-400 mx-auto mb-2" />
        <p className="text-[12px] text-zinc-500 font-medium">Nenhuma foto de evolução enviada ainda.</p>
        <p className="text-[11px] text-zinc-400 mt-1">Envie suas fotos no feedback mensal.</p>
      </div>
    );
  }

  if (envios.length === 1) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          {SLOTS.map((s) => {
            const url = resolve(antes!.fotos[s.key]);
            return (
              <div key={s.key} className="space-y-1">
                <div className="aspect-[3/4] rounded-xl bg-zinc-100 overflow-hidden ring-1 ring-black/5">
                  {url ? (
                    <img src={url} alt={s.label} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-[10px] text-zinc-400">—</div>
                  )}
                </div>
                <p className="text-[10px] text-center text-zinc-500 font-medium">{s.label}</p>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-center text-zinc-500">
          Primeira foto enviada em <strong>{fmt(antes!.data)}</strong>. Envie um novo feedback mensal pra ver sua evolução lado a lado.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-[11px] text-zinc-500 font-medium">
        <span>Comparando <strong className="text-zinc-900">{fmt(antes!.data)}</strong> → <strong className="text-zinc-900">{fmt(depois!.data)}</strong></span>
        <span className="text-zinc-400">{envios.length} envios</span>
      </div>

      <div className="space-y-3">
        {SLOTS.map((slot) => {
          const a = resolve(antes!.fotos[slot.key]);
          const d = resolve(depois!.fotos[slot.key]);
          if (!a && !d) return null;
          return (
            <div key={slot.key} className="space-y-1.5">
              <p className="text-[10px] font-extrabold tracking-[0.18em] text-zinc-500 text-center uppercase">{slot.label}</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-zinc-100 ring-1 ring-black/5">
                  {a ? <img src={a} alt="antes" className="h-full w-full object-cover" /> : <div className="h-full w-full flex items-center justify-center text-[10px] text-zinc-400">—</div>}
                  <span className="absolute top-2 left-2 rounded-md bg-white/95 text-[9px] font-bold px-1.5 py-0.5 text-zinc-900">ANTES</span>
                  <span className="absolute bottom-2 right-2 rounded-md bg-black/65 text-[9px] font-semibold px-1.5 py-0.5 text-white">{fmt(antes!.data)}</span>
                </div>
                <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-zinc-100 ring-1 ring-black/5">
                  {d ? <img src={d} alt="agora" className="h-full w-full object-cover" /> : <div className="h-full w-full flex items-center justify-center text-[10px] text-zinc-400">—</div>}
                  <span className="absolute top-2 left-2 rounded-md bg-[#F70906] text-[9px] font-bold px-1.5 py-0.5 text-white">AGORA</span>
                  <span className="absolute bottom-2 right-2 rounded-md bg-black/65 text-[9px] font-semibold px-1.5 py-0.5 text-white">{fmt(depois!.data)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={exportarPNG}
        disabled={exporting}
        className="w-full h-11 rounded-xl bg-[#F70906] text-white text-[13px] font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition disabled:opacity-60 shadow-[0_6px_20px_-8px_rgba(247,9,6,0.55)]"
      >
        {exporting ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Gerando imagem…</>
        ) : (
          <><Download className="h-4 w-4" strokeWidth={2.6} /> Salvar PNG para Instagram</>
        )}
      </button>
      <p className="text-[10px] text-center text-zinc-400">
        Imagem em formato story (1080×1920) com a logo MPTEAM.
      </p>
    </div>
  );
}