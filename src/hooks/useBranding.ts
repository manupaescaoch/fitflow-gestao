import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import mpLogo from "@/assets/mp-logo.png";
import { aplicarCorSistema, COR_PADRAO } from "@/lib/tema";

export type Branding = { nome: string; subtitulo: string; logo_url: string | null; cor_primaria: string };

export const BRANDING_PADRAO: Branding = { nome: "MPTEAM", subtitulo: "CRM", logo_url: null, cor_primaria: COR_PADRAO };
export const LOGO_PADRAO = mpLogo;

const CHAVE_CACHE = "mpteam_branding";

function lerCacheLocal(): Branding | null {
  if (typeof window === "undefined") return null;
  try {
    const bruto = localStorage.getItem(CHAVE_CACHE);
    if (!bruto) return null;
    const b = JSON.parse(bruto) as Branding;
    if (!b || typeof b.nome !== "string") return null;
    return { ...BRANDING_PADRAO, ...b };
  } catch {
    return null;
  }
}

let cache: Branding | null = null;
let pendente: Promise<Branding> | null = null;
const listeners = new Set<(b: Branding) => void>();

async function fetchBranding(): Promise<Branding> {
  const { data } = await (supabase as any)
    .from("app_branding")
    .select("nome, subtitulo, logo_url, cor_primaria")
    .maybeSingle();
  const b: Branding = data
    ? {
        nome: data.nome ?? BRANDING_PADRAO.nome,
        subtitulo: data.subtitulo ?? BRANDING_PADRAO.subtitulo,
        logo_url: data.logo_url ?? null,
        cor_primaria: data.cor_primaria || COR_PADRAO,
      }
    : BRANDING_PADRAO;
  cache = b;
  try { localStorage.setItem(CHAVE_CACHE, JSON.stringify(b)); } catch { /* cota cheia */ }
  aplicarCorSistema(b.cor_primaria);
  listeners.forEach((l) => l(b));
  return b;
}


/** Recarrega o nome/logo em todas as telas abertas. */
export async function recarregarBranding() {
  pendente = fetchBranding();
  await pendente;
}

/** Nome, subtítulo e logo do sistema (personalizáveis em Configurações). */
export function useBranding() {
  const [branding, setBranding] = useState<Branding>(cache ?? BRANDING_PADRAO);

  useEffect(() => {
    listeners.add(setBranding);
    if (!cache) {
      pendente = pendente ?? fetchBranding();
      void pendente.then(setBranding).catch(() => undefined);
    }
    return () => { listeners.delete(setBranding); };
  }, []);

  return { ...branding, logo: branding.logo_url || LOGO_PADRAO };
}
