import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Modalidade } from "./crm";

export type PlanoCatalogo = {
  id: string;
  nome: string;
  modalidade: Modalidade;
  valor_padrao: number;
  duracao_dias: number;
  ativo: boolean;
  descricao: string | null;
};

/** Carrega planos ativos do catálogo, ordenados por modalidade > valor. */
export function usePlanosCatalogo() {
  const [planos, setPlanos] = useState<PlanoCatalogo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("planos_catalogo")
        .select("id, nome, modalidade, valor_padrao, duracao_dias, ativo, descricao")
        .eq("ativo", true)
        .order("modalidade", { ascending: true })
        .order("valor_padrao", { ascending: true });
      if (!cancelled) {
        setPlanos((data ?? []) as PlanoCatalogo[]);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { planos, loading };
}

/** Formata uma opção do select: "Nome (30 dias)". */
export function formatPlanoOption(p: PlanoCatalogo): string {
  return `${p.nome} (${p.duracao_dias} dias)`;
}