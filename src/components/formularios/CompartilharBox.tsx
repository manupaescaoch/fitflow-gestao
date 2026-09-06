import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Copy, MessageCircle, Code2, ExternalLink, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { linkPublico } from "@/lib/formularios";

export function CompartilharBox({ slug, titulo }: { slug: string; titulo: string }) {
  const url = linkPublico(slug);
  const [qr, setQr] = useState<string>("");
  const embed = `<iframe src="${url}" width="100%" height="900" style="border:0" title="${titulo}"></iframe>`;

  useEffect(() => {
    void QRCode.toDataURL(url, { width: 320, margin: 1 }).then(setQr).catch(() => setQr(""));
  }, [url]);

  const copiar = async (txt: string, msg: string) => {
    await navigator.clipboard.writeText(txt);
    toast.success(msg);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-muted-foreground">Link público</label>
        <div className="mt-1 flex gap-2">
          <Input readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
          <Button variant="outline" size="icon" onClick={() => void copiar(url, "Link copiado")} aria-label="Copiar link">
            <Copy className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => window.open(url, "_blank")} aria-label="Abrir link">
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {qr && (
        <div className="flex items-center gap-4 rounded-lg border border-border p-3">
          <img src={qr} alt={`QR Code do formulário ${titulo}`} className="h-28 w-28" />
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Aponte a câmera do celular para abrir o formulário.</p>
            <a href={qr} download={`qrcode-${slug}.png`}>
              <Button variant="outline" size="sm"><Download className="mr-2 h-3.5 w-3.5" /> Baixar QR Code</Button>
            </a>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm"
          onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`${titulo}: ${url}`)}`, "_blank")}>
          <MessageCircle className="mr-2 h-3.5 w-3.5" /> WhatsApp
        </Button>
        <Button variant="outline" size="sm" onClick={() => void copiar(embed, "Código de incorporação copiado")}>
          <Code2 className="mr-2 h-3.5 w-3.5" /> Copiar código de incorporação
        </Button>
      </div>
    </div>
  );
}
