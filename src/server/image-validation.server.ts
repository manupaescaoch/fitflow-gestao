/**
 * Valida bytes de imagem: confere magic numbers, retorna mime real.
 * Suporta JPEG, PNG, WebP, GIF e HEIC/HEIF.
 */
export type ValidImageMime =
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "image/gif"
  | "image/heic"
  | "image/heif";

export function detectImageMime(buf: Buffer): ValidImageMime | null {
  if (buf.length < 12) return null;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  )
    return "image/png";
  // GIF: "GIF87a" ou "GIF89a"
  if (
    buf[0] === 0x47 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x38 &&
    (buf[4] === 0x37 || buf[4] === 0x39) &&
    buf[5] === 0x61
  )
    return "image/gif";
  // WebP: "RIFF" .... "WEBP"
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  )
    return "image/webp";
  // HEIC/HEIF: bytes 4..11 = "ftyp" + brand
  if (
    buf[4] === 0x66 &&
    buf[5] === 0x74 &&
    buf[6] === 0x79 &&
    buf[7] === 0x70
  ) {
    const brand = buf.slice(8, 12).toString("ascii");
    if (
      brand === "heic" ||
      brand === "heix" ||
      brand === "hevc" ||
      brand === "hevx" ||
      brand === "mif1" ||
      brand === "msf1"
    )
      return brand.startsWith("hev") ? "image/heic" : "image/heif";
  }
  return null;
}

export type ImageDecodeResult =
  | { ok: true; buf: Buffer; mime: ValidImageMime; ext: string }
  | { ok: false; error: string };

const EXT: Record<ValidImageMime, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
};

/**
 * Decodifica base64 (com ou sem prefixo data:), valida bytes e tamanho.
 */
export function decodeAndValidateImage(
  fileBase64: string,
  declaredMime: string,
  maxBytes: number,
): ImageDecodeResult {
  const m = fileBase64.match(/^data:([^;]+);base64,(.+)$/);
  const b64 = m ? m[2] : fileBase64;
  let buf: Buffer;
  try {
    buf = Buffer.from(b64, "base64");
  } catch {
    return { ok: false, error: "Arquivo inválido (base64)" };
  }
  if (buf.byteLength === 0) return { ok: false, error: "Arquivo vazio" };
  if (buf.byteLength > maxBytes) {
    const mb = Math.round(maxBytes / 1024 / 1024);
    return { ok: false, error: `Imagem maior que ${mb}MB` };
  }
  const realMime = detectImageMime(buf);
  if (!realMime) {
    return {
      ok: false,
      error: "Formato não suportado. Envie JPG, PNG, WebP, GIF ou HEIC.",
    };
  }
  // Sanity check: se o cliente declarou um mime de imagem incompatível, rejeita.
  const declared = (declaredMime || "").toLowerCase();
  if (declared.startsWith("image/") && !declared.includes("*")) {
    const declaredOk =
      declared === realMime ||
      (declared === "image/jpg" && realMime === "image/jpeg") ||
      (declared === "image/heic" && realMime === "image/heif") ||
      (declared === "image/heif" && realMime === "image/heic");
    if (!declaredOk) {
      return {
        ok: false,
        error: "Tipo de arquivo não corresponde ao conteúdo",
      };
    }
  }
  return { ok: true, buf, mime: realMime, ext: EXT[realMime] };
}
