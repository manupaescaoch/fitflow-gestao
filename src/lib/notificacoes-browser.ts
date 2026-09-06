/**
 * Avisos do sistema (notificações do navegador) para a equipe.
 *
 * Não registra service worker: usa a API de Notification da própria aba.
 * Em preview/iframe o navegador bloqueia o pedido de permissão, então
 * detectamos esse caso e avisamos o usuário para abrir em uma aba própria.
 */

export type EstadoAvisos =
  | "nao-suportado"
  | "iframe"
  | "negado"
  | "ativo"
  | "inativo";

export function suportaAvisos() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function dentroDeIframe() {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function estadoAvisos(): EstadoAvisos {
  if (!suportaAvisos()) return "nao-suportado";
  if (dentroDeIframe()) return "iframe";
  const p = Notification.permission;
  if (p === "granted") return "ativo";
  if (p === "denied") return "negado";
  return "inativo";
}

/** Pede permissão. Precisa ser chamado a partir de um clique do usuário. */
export async function pedirPermissaoAvisos(): Promise<EstadoAvisos> {
  const atual = estadoAvisos();
  if (atual !== "inativo") return atual;
  try {
    const r = await Notification.requestPermission();
    return r === "granted" ? "ativo" : r === "denied" ? "negado" : "inativo";
  } catch {
    return "inativo";
  }
}

const LS_KEY = "mpteam_avisos_equipe";

export function avisosLigados() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(LS_KEY) === "1";
}

export function setAvisosLigados(v: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LS_KEY, v ? "1" : "0");
}

/** Mostra um aviso do sistema, se estiver permitido e ligado. */
export function mostrarAviso(titulo: string, corpo?: string | null, url?: string | null) {
  if (estadoAvisos() !== "ativo" || !avisosLigados()) return;
  try {
    const n = new Notification(titulo, {
      body: corpo ?? undefined,
      icon: "/mp-logo.png",
      badge: "/mp-logo.png",
      tag: `mpteam-crm-${titulo}`,
    });
    n.onclick = () => {
      window.focus();
      if (url) window.location.href = url;
      n.close();
    };
  } catch {
    /* silencioso */
  }
}
