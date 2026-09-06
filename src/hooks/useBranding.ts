import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import mpLogo from "@/assets/mp-logo.png";

export type Branding = { nome: string; subtitulo: string; logo_url: string | null };

export const BRANDING_PADRAO: Branding = { nome: "MPTEAM", subtitulo: "CRM", logo_url: null };
export const LOGO_PADRAO = mpLogo;

let cache: Branding | null = null;
let pendente: Promise<Branding> | null = null;
const listeners = new Set<(b: Branding) => void>();

async function fetchBranding(): Promise<Branding> {
  const { data } = await (supabase as any)
    .from("app_branding")
    .select("nome, subtitulo, logo_url")
    .maybeSingle();
  const b: Branding = data
    ? {
        nome: data.nome ?? BRANDING_PADRAO.nome,
        subtitulo: data.subtitulo ?? BRANDING_PADRAO.subtitulo,
        logo_url: data.logo_url ?? null,
      }
    : BRANDING_PADRAO;
  cache = b;
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
