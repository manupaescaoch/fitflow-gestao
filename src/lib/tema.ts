/** Aplica a cor principal escolhida em Configurações > Personalizar. */
export const COR_PADRAO = "#2563EB";

function hexValido(hex: string) {
  return /^#([0-9a-f]{6})$/i.test(hex.trim());
}

/** Retorna preto ou branco conforme o contraste da cor. */
function contraste(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.62 ? "#111111" : "#ffffff";
}

export function aplicarCorSistema(cor?: string | null) {
  if (typeof document === "undefined") return;
  const hex = cor && hexValido(cor) ? cor.trim() : COR_PADRAO;
  const s = document.documentElement.style;
  const fg = contraste(hex);
  const claro = `color-mix(in oklab, ${hex} 12%, white)`;
  const escuro = `color-mix(in oklab, ${hex} 85%, black)`;

  s.setProperty("--primary", hex);
  s.setProperty("--primary-foreground", fg);
  s.setProperty("--ring", hex);
  s.setProperty("--accent", claro);
  s.setProperty("--accent-foreground", escuro);
  s.setProperty("--sidebar-primary", hex);
  s.setProperty("--sidebar-primary-foreground", fg);
  s.setProperty("--sidebar-accent", claro);
  s.setProperty("--sidebar-accent-foreground", escuro);
  s.setProperty("--sidebar-ring", hex);
  s.setProperty("--chart-1", hex);
}
