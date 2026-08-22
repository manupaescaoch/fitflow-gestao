import { useEffect, useRef, useState } from "react";
import { X, Download, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import type jsPDF from "jspdf";

/**
 * Modal global que renderiza uma prévia paginada (rasterizada via pdf.js)
 * de um documento jsPDF antes de baixar. Acionado pelo evento
 * "dieta:preview-pdf" disparado por exportarPdfDieta.
 */

type Detail = {
  doc: jsPDF;
  filename: string;
};

export function PreviaPdfModal() {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [pages, setPages] = useState<string[]>([]); // dataURLs renderizadas
  const [pageIdx, setPageIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onOpen(e: Event) {
      const ce = e as CustomEvent<Detail>;
      setDetail(ce.detail);
      setPageIdx(0);
      setPages([]);
    }
    window.addEventListener("dieta:preview-pdf", onOpen as EventListener);
    return () => window.removeEventListener("dieta:preview-pdf", onOpen as EventListener);
  }, []);

  // Renderiza todas as páginas quando o doc muda
  useEffect(() => {
    if (!detail) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        // Worker a partir do mesmo bundle
        const workerUrl = (await import("pdfjs-dist/build/pdf.worker.mjs?url")).default;
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

        const ab = detail.doc.output("arraybuffer") as ArrayBuffer;
        const loadingTask = pdfjs.getDocument({ data: ab });
        const pdf = await loadingTask.promise;
        const out: string[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          if (cancelled) return;
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1.6 });
          const canvas = document.createElement("canvas");
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          const ctx = canvas.getContext("2d")!;
          // @ts-expect-error -- canvas tipagem do pdfjs
          await page.render({ canvasContext: ctx, viewport }).promise;
          out.push(canvas.toDataURL("image/png"));
        }
        if (!cancelled) setPages(out);
      } catch (err) {
        console.error("[PreviaPdfModal] falha ao rasterizar", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [detail]);

  if (!detail) return null;

  function fechar() {
    setDetail(null);
    setPages([]);
    setPageIdx(0);
  }

  function baixar() {
    if (!detail) return;
    detail.doc.save(detail.filename);
  }

  const totalPages = pages.length;
  const atual = pages[pageIdx];

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/80 backdrop-blur-sm">
      {/* Topbar */}
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-neutral-900 px-4 py-2 text-white">
        <div className="flex items-center gap-3 text-sm">
          <span className="font-medium">Prévia do PDF</span>
          <span className="text-white/60">{detail.filename}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPageIdx((i) => Math.max(0, i - 1))}
            disabled={pageIdx === 0 || totalPages === 0}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-white/10 hover:bg-white/20 disabled:opacity-40"
            aria-label="Página anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[72px] text-center text-xs tabular-nums text-white/80">
            {totalPages === 0 ? "—" : `${pageIdx + 1} / ${totalPages}`}
          </span>
          <button
            type="button"
            onClick={() => setPageIdx((i) => Math.min(totalPages - 1, i + 1))}
            disabled={pageIdx >= totalPages - 1}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-white/10 hover:bg-white/20 disabled:opacity-40"
            aria-label="Próxima página"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="mx-2 h-5 w-px bg-white/20" />
          <button
            type="button"
            onClick={baixar}
            disabled={loading || totalPages === 0}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-red-600 px-3 text-xs font-medium hover:bg-red-500 disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" /> Baixar PDF
          </button>
          <button
            type="button"
            onClick={fechar}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-white/10 hover:bg-white/20"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Conteúdo */}
      <div ref={containerRef} className="flex-1 overflow-auto p-6">
        {loading && (
          <div className="flex h-full items-center justify-center text-white/80">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Renderizando prévia…
          </div>
        )}
        {!loading && atual && (
          <div className="mx-auto flex max-w-[900px] flex-col items-center gap-4">
            <img
              src={atual}
              alt={`Página ${pageIdx + 1}`}
              className="w-full rounded-md bg-white shadow-xl ring-1 ring-black/30"
            />
            {totalPages > 1 && (
              <div className="flex flex-wrap justify-center gap-2 pb-4">
                {pages.map((p, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setPageIdx(i)}
                    className={`h-16 overflow-hidden rounded border-2 transition ${
                      i === pageIdx ? "border-red-500" : "border-white/20 hover:border-white/50"
                    }`}
                    aria-label={`Ir para página ${i + 1}`}
                  >
                    <img src={p} alt="" className="h-full w-auto bg-white" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}