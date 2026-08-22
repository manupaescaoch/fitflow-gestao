import { uploadAnamneseFile } from "@/server/anamnese-uploads.functions";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const idx = result.indexOf("base64,");
      resolve(idx >= 0 ? result.slice(idx + 7) : result);
    };
    reader.onerror = () => reject(reader.error || new Error("read error"));
    reader.readAsDataURL(file);
  });
}

/**
 * Converte HEIC/HEIF para JPEG no browser (Chrome/Firefox não renderizam HEIC).
 * Se o arquivo não for HEIC, devolve o original.
 */
async function ensureBrowserCompatible(file: File): Promise<File> {
  const nome = (file.name || "").toLowerCase();
  const tipo = (file.type || "").toLowerCase();
  const ehHeic =
    tipo.includes("heic") ||
    tipo.includes("heif") ||
    nome.endsWith(".heic") ||
    nome.endsWith(".heif");
  if (!ehHeic) return file;
  if (typeof window === "undefined") return file;
  try {
    const mod = await import("heic2any");
    const heic2any = (mod as any).default || (mod as any);
    const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
    const blob: Blob = Array.isArray(out) ? out[0] : out;
    const baseNome = (file.name || "imagem").replace(/\.(heic|heif)$/i, "");
    return new File([blob], `${baseNome}.jpg`, { type: "image/jpeg" });
  } catch (e) {
    console.warn("[anamnese-upload] falha ao converter HEIC, enviando original:", e);
    return file;
  }
}

/**
 * Redimensiona/recomprime imagens grandes no browser pra evitar timeout de upload
 * em conexões móveis. Mantém o arquivo original se já for pequeno, se não for
 * imagem, ou se algo falhar (fallback seguro).
 */
async function compressImageIfNeeded(file: File): Promise<File> {
  if (typeof window === "undefined") return file;
  const tipo = (file.type || "").toLowerCase();
  if (!tipo.startsWith("image/")) return file;
  if (tipo === "image/gif") return file; // preserva animação
  // Se já é pequeno (<1.2MB), não reprocessa
  if (file.size <= 1.2 * 1024 * 1024) return file;
  const MAX_DIM = 1600;
  const QUALITY = 0.85;
  try {
    const bitmap = await createImageBitmap(file).catch(async () => {
      // fallback via <img> se createImageBitmap não suportar o formato
      const url = URL.createObjectURL(file);
      try {
        const img = await new Promise<HTMLImageElement>((res, rej) => {
          const i = new Image();
          i.onload = () => res(i);
          i.onerror = () => rej(new Error("img load"));
          i.src = url;
        });
        return img as unknown as ImageBitmap;
      } finally {
        URL.revokeObjectURL(url);
      }
    });
    const w = (bitmap as any).width as number;
    const h = (bitmap as any).height as number;
    if (!w || !h) return file;
    const scale = Math.min(1, MAX_DIM / Math.max(w, h));
    const tw = Math.round(w * scale);
    const th = Math.round(h * scale);
    const canvas = document.createElement("canvas");
    canvas.width = tw;
    canvas.height = th;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap as any, 0, 0, tw, th);
    const blob: Blob | null = await new Promise((res) =>
      canvas.toBlob((b) => res(b), "image/jpeg", QUALITY),
    );
    if (!blob || blob.size === 0) return file;
    // Se a "compressão" piorou (raro), usa original
    if (blob.size >= file.size) return file;
    const baseNome = (file.name || "imagem").replace(/\.[^.]+$/, "");
    return new File([blob], `${baseNome}.jpg`, { type: "image/jpeg" });
  } catch (e) {
    console.warn("[anamnese-upload] falha ao comprimir, enviando original:", e);
    return file;
  }
}

/**
 * Sobe um arquivo para o bucket anamnese-uploads via server function (service role).
 * Funciona tanto para o aluno público (sem login) quanto para a equipe autenticada.
 */
export async function uploadAnamneseAsset(params: {
  pathPrefix: string;
  file: File;
  token?: string;
}): Promise<{ url: string | null; error: string | null }> {
  try {
    const fileCompat = await ensureBrowserCompatible(params.file);
    const file = await compressImageIfNeeded(fileCompat);
    const base64 = await fileToBase64(file);
    const res = await uploadAnamneseFile({
      data: {
        pathPrefix: params.pathPrefix,
        filename: file.name || "arquivo",
        contentType: file.type || "application/octet-stream",
        base64,
        token: params.token,
      },
    });
    return res;
  } catch (e: any) {
    return { url: null, error: e?.message || "Falha no upload" };
  }
}
