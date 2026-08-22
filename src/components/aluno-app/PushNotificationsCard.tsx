import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  salvarPushSubscription,
  removerPushSubscription,
} from "@/server/aluno-push.functions";
import { VAPID_PUBLIC_KEY, urlBase64ToUint8Array } from "@/lib/push-vapid";

type Estado = "carregando" | "nao-suportado" | "preview" | "negado" | "ativo" | "inativo";

function isPreviewHost() {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return (
    h.includes("id-preview--") ||
    h.includes("lovableproject.com") ||
    h.includes("lovable.app/preview")
  );
}

function isInIframe() {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function isSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function PushNotificationsCard() {
  const [estado, setEstado] = useState<Estado>("carregando");
  const [busy, setBusy] = useState(false);
  const salvar = useServerFn(salvarPushSubscription);
  const remover = useServerFn(removerPushSubscription);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      if (!isSupported()) {
        if (!cancelado) setEstado("nao-suportado");
        return;
      }
      if (isInIframe() || isPreviewHost()) {
        if (!cancelado) setEstado("preview");
        return;
      }
      if (Notification.permission === "denied") {
        if (!cancelado) setEstado("negado");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.getRegistration("/sw.js");
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        if (!cancelado) setEstado(sub ? "ativo" : "inativo");
      } catch {
        if (!cancelado) setEstado("inativo");
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  async function ativar() {
    if (busy) return;
    setBusy(true);
    try {
      const reg =
        (await navigator.serviceWorker.getRegistration("/sw.js")) ||
        (await navigator.serviceWorker.register("/sw.js", { scope: "/" }));
      // Aguarda ficar ativo
      if (!reg.active) {
        await new Promise<void>((resolve) => {
          const sw = reg.installing || reg.waiting;
          if (!sw) return resolve();
          sw.addEventListener("statechange", () => {
            if (sw.state === "activated") resolve();
          });
        });
      }
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setEstado(perm === "denied" ? "negado" : "inativo");
        toast.error("Permissão de notificações não concedida");
        return;
      }
      const keyArr = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      const keyBuf = keyArr.buffer.slice(
        keyArr.byteOffset,
        keyArr.byteOffset + keyArr.byteLength,
      ) as ArrayBuffer;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBuf,
      });
      const json = sub.toJSON() as {
        endpoint?: string;
        keys?: { p256dh?: string; auth?: string };
      };
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error("Inscrição inválida");
      }
      await salvar({
        data: {
          endpoint: json.endpoint,
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
          user_agent: navigator.userAgent.slice(0, 512),
        },
      });
      setEstado("ativo");
      toast.success("Notificações ativadas");
    } catch (err) {
      console.error("[push] ativar falhou:", err);
      toast.error("Não foi possível ativar as notificações");
    } finally {
      setBusy(false);
    }
  }

  async function desativar() {
    if (busy) return;
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe().catch(() => {});
        await remover({ data: { endpoint } }).catch(() => {});
      }
      setEstado("inativo");
      toast.success("Notificações desativadas");
    } catch (err) {
      console.error("[push] desativar falhou:", err);
      toast.error("Não foi possível desativar agora");
    } finally {
      setBusy(false);
    }
  }

  // Render
  const ativo = estado === "ativo";
  const Icon = ativo ? Bell : BellOff;

  return (
    <section className="rounded-2xl bg-white border border-black/5 p-4 shadow-[0_2px_10px_-6px_rgba(0,0,0,0.08)]">
      <div className="flex items-start gap-3">
        <div
          className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${
            ativo ? "bg-emerald-50 text-emerald-600" : "bg-zinc-100 text-zinc-500"
          }`}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-zinc-900">Notificações</div>
          <p className="text-[11px] text-zinc-500 mt-0.5 leading-snug">
            Receba lembretes de check-in, água, treino e novidades direto no seu celular.
          </p>

          {estado === "carregando" && (
            <div className="mt-3 text-[11px] text-zinc-400 inline-flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Verificando…
            </div>
          )}

          {estado === "nao-suportado" && (
            <div className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-zinc-500 bg-zinc-50 rounded-lg px-2 py-1.5">
              <AlertCircle className="h-3 w-3" />
              Seu navegador não suporta notificações push.
            </div>
          )}

          {estado === "preview" && (
            <div className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-zinc-500 bg-zinc-50 rounded-lg px-2 py-1.5">
              <AlertCircle className="h-3 w-3" />
              Disponível na versão publicada do app, fora do preview.
            </div>
          )}

          {estado === "negado" && (
            <div className="mt-3 text-[11px] text-rose-600 bg-rose-50 rounded-lg px-2 py-1.5 leading-snug">
              Você bloqueou notificações para este site. Libere nas configurações
              do navegador para reativar.
            </div>
          )}

          {(estado === "inativo" || estado === "ativo") && (
            <button
              type="button"
              onClick={ativo ? desativar : ativar}
              disabled={busy}
              className={`mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${
                ativo
                  ? "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                  : "bg-zinc-900 text-white hover:bg-zinc-800"
              } disabled:opacity-60`}
            >
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {ativo ? "Desativar" : "Ativar notificações"}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}