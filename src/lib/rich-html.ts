const ALLOWED_TAGS = new Set([
  "B", "STRONG", "I", "EM", "U", "UL", "OL", "LI", "P", "BR", "SPAN", "DIV", "FONT", "MARK",
]);

const ALLOWED_FONT_SIZES = new Set([
  "9px", "11px", "13px", "14px", "16px", "18px", "20px", "22px", "24px",
  "small", "medium", "large", "x-large",
]);

export function isHtml(s: string): boolean {
  return /<[a-z][^>]*>/i.test(s);
}

export function plainTextToHtml(txt: string): string {
  if (!txt) return "";
  const escaped = txt
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped
    .split(/\n\s*\n/)
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function sanitizeNode(node: Node, out: Document): Node | null {
  if (node.nodeType === 3) {
    // text
    return out.createTextNode(node.textContent ?? "");
  }
  if (node.nodeType !== 1) return null;
  const el = node as Element;
  const tag = el.tagName.toUpperCase();
  if (!ALLOWED_TAGS.has(tag)) {
    // unwrap unknown tags but keep children
    const frag = out.createDocumentFragment();
    el.childNodes.forEach((child) => {
      const c = sanitizeNode(child, out);
      if (c) frag.appendChild(c);
    });
    return frag;
  }
  const clean = out.createElement(tag.toLowerCase());
  if (tag === "SPAN" || tag === "P" || tag === "DIV") {
    const style = el.getAttribute("style") ?? "";
    const m = style.match(/font-size:\s*([^;]+)/i);
    if (m) {
      const val = m[1].trim().toLowerCase().replace(/\s+/g, "");
      if (ALLOWED_FONT_SIZES.has(val)) {
        clean.setAttribute("style", `font-size: ${val}`);
      }
    }
    const fw = style.match(/font-weight:\s*(bold|[5-9]00)/i);
    if (fw) {
      const cur = clean.getAttribute("style") ?? "";
      clean.setAttribute("style", `${cur}${cur ? "; " : ""}font-weight: bold`);
    }
    const colorMatch = style.match(/(?:^|;|\s)color:\s*(#[0-9a-f]{3,8}|rgb\([^)]+\)|[a-z]+)/i);
    if (colorMatch) {
      const cur = clean.getAttribute("style") ?? "";
      clean.setAttribute("style", `${cur}${cur ? "; " : ""}color: ${colorMatch[1]}`);
    }
    const bgMatch = style.match(/background-color:\s*(#[0-9a-f]{3,8}|rgb\([^)]+\)|[a-z]+)/i);
    if (bgMatch) {
      const cur = clean.getAttribute("style") ?? "";
      clean.setAttribute("style", `${cur}${cur ? "; " : ""}background-color: ${bgMatch[1]}`);
    }
  }
  if (tag === "FONT") {
    const color = el.getAttribute("color");
    if (color) clean.setAttribute("color", color);
  }
  if (tag === "MARK") {
    const style = el.getAttribute("style") ?? "";
    const bgMatch = style.match(/background(?:-color)?:\s*(#[0-9a-f]{3,8}|rgb\([^)]+\)|[a-z]+)/i);
    if (bgMatch) {
      clean.setAttribute("style", `background-color: ${bgMatch[1]}`);
    }
  }
  el.childNodes.forEach((child) => {
    const c = sanitizeNode(child, out);
    if (c) clean.appendChild(c);
  });
  return clean;
}

export function sanitizeRichHtml(html: string): string {
  if (!html) return "";
  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    // SSR fallback: strip tags
    return html.replace(/<[^>]*>/g, "");
  }
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstElementChild;
  if (!root) return "";
  const out = document.implementation.createHTMLDocument("");
  const wrapper = out.createElement("div");
  root.childNodes.forEach((child) => {
    const c = sanitizeNode(child, out);
    if (c) wrapper.appendChild(c);
  });
  return wrapper.innerHTML;
}

export function normalizeRich(value: string | undefined | null): string {
  if (!value) return "";
  return isHtml(value) ? sanitizeRichHtml(value) : plainTextToHtml(value);
}

export function htmlToPlainText(value: string | undefined | null): string {
  if (!value) return "";
  if (!isHtml(value)) return value;
  // Substitui tags de bloco/quebra por \n antes de remover o restante
  const withBreaks = value
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/\s*(div|p|li|tr)\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  // Decodifica entidades comuns
  const decoded = withBreaks
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  // Normaliza quebras múltiplas
  return decoded.replace(/\n{3,}/g, "\n\n").replace(/[ \t]+\n/g, "\n").trim();
}