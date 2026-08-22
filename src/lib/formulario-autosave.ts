import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  salvarRascunhoFormulario,
  carregarRascunhoFormulario,
} from "@/server/formulario-publico-flow.functions";

/**
 * Autosave server-side de rascunho de formulário público.
 *
 * Estratégia: a cada mudança em `data` ou `step`, agenda um save com debounce
 * para `formularios.dados_resposta`, mantendo `respondido = false`. Estrutura
 * salva: { _draft: true, _step: number, data: T, _saved_at: iso }.
 *
 * Não roda enquanto !enabled (ex.: usuário ainda não começou) ou se já enviou.
 */
export function useAutosaveFormulario<T>(opts: {
  formId: string;
  token: string;
  step: number;
  data: T;
  enabled: boolean;
  debounceMs?: number;
}) {
  const { formId, token, step, data, enabled, debounceMs = 1500 } = opts;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSerializedRef = useRef<string>("");
  const inFlightRef = useRef(false);
  const salvarFn = useServerFn(salvarRascunhoFormulario);

  useEffect(() => {
    if (!enabled || !formId || !token) return;
    const serialized = JSON.stringify({ step, data });
    if (serialized === lastSerializedRef.current) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        const res = await salvarFn({ data: { formId, token, step, data: data as unknown } });
        if ((res as any)?.ok) lastSerializedRef.current = serialized;
      } catch {
        // silencioso: localStorage continua sendo a rede de segurança
      } finally {
        inFlightRef.current = false;
      }
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [formId, token, step, data, enabled, debounceMs, salvarFn]);
}

/**
 * Carrega rascunho salvo no servidor para um formulário ainda não respondido.
 * Retorna null se não houver rascunho válido.
 */
export async function carregarRascunhoServidor(formId: string, token: string): Promise<{
  step: number;
  data: any;
} | null> {
  try {
    const res = await carregarRascunhoFormulario({ data: { formId, token } });
    if (!(res as any)?.ok) return null;
    return { step: (res as any).step ?? 0, data: (res as any).data };
  } catch {
    return null;
  }
}