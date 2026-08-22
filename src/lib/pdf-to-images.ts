// Renderiza cada página de um PDF como PNG no navegador usando pdfjs-dist.
// Uso: const files = await pdfToImageFiles(file)

let pdfjsLibPromise: Promise<any> | null = null;

async function getPdfjs() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = (async () => {
      const pdfjs: any = await import("pdfjs-dist");
      // Worker via CDN evita problemas de bundling com Vite
      const version = pdfjs.version || "5.7.284";
      pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;
      return pdfjs;
    })();
  }
  return pdfjsLibPromise;
}

function canvasToPngFile(canvas: HTMLCanvasElement, baseName: string, pageNum: number): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Falha ao converter página em imagem"));
        return;
      }
      const file = new File([blob], `${baseName}-p${pageNum}.png`, { type: "image/png" });
      resolve(file);
    }, "image/png", 0.92);
  });
}

export async function pdfToImageFiles(pdfFile: File, opts?: { maxPages?: number; scale?: number }): Promise<File[]> {
  const pdfjs = await getPdfjs();
  const arrayBuffer = await pdfFile.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const max = Math.min(pdf.numPages, opts?.maxPages ?? 10);
  const scale = opts?.scale ?? 1.6;
  const baseName = (pdfFile.name || "pdf").replace(/\.pdf$/i, "").replace(/[^a-z0-9_\-]/gi, "_");

  const out: File[] = [];
  for (let i = 1; i <= max; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context indisponível");
    await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
    const file = await canvasToPngFile(canvas, baseName, i);
    out.push(file);
  }
  return out;
}