import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, BellRing, Check, Loader2 } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase as supabaseClient } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  avisosLigados,
  estadoAvisos,
  mostrarAviso,
  pedirPermissaoAvisos,
  setAvisosLigados,
  type EstadoAvisos,
} from "@/lib/notificacoes-browser";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = supabaseClient as any;

export interface Notificacao {
  id: string;
  titulo: string;
  mensagem: string | null;
  link: string | null;
  lida: boolean;
  criado_em: string;
}

export function NotificacoesSino({ compact = false }: { compact?: boolean }) {
  const nav = useNavigate();
  const [itens, setItens] = useState<Notificacao[]>([]);
  const [loading, setLoading] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [estado, setEstado] = useState<EstadoAvisos>("inativo");
  const [ligado, setLigado] = useState(false);
  const vistosRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    setEstado(estadoAvisos());
    setLigado(avisosLigados());
  }, []);

  const carregar = useCallback(async () => {
    setLoading(true);
    const { data: sessao } = await supabase.auth.getUser();
    const uid = sessao?.user?.id;
    if (!uid) { setLoading(false); return; }
    const { data } = await supabase
      .from("notificacoes")
      .select("id, titulo, mensagem, link, lida, criado_em")
      .eq("usuario_id", uid)
      .order("criado_em", { ascending: false })
      .limit(25);
    const lista = (data ?? []) as Notificacao[];

    // Avisa sobre o que chegou depois da primeira carga
    if (vistosRef.current === null) {
      vistosRef.current = new Set(lista.map((n) => n.id));
    } else {
      const novas = lista.filter((n) => !vistosRef.current!.has(n.id) && !n.lida);
      novas.slice(0, 3).forEach((n) => {
        mostrarAviso(n.titulo, n.mensagem, n.link);
        toast(n.titulo, { description: n.mensagem ?? undefined });
      });
      lista.forEach((n) => vistosRef.current!.add(n.id));
    }

    setItens(lista);
    setLoading(false);
  }, []);

  useEffect(() => {
    void carregar();
    const t = setInterval(() => void carregar(), 30_000);
    const onFocus = () => void carregar();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, [carregar]);

  const naoLidas = itens.filter((n) => !n.lida).length;

  async function alternarAvisos() {
    if (ligado) {
      setAvisosLigados(false);
      setLigado(false);
      toast("Avisos do sistema desligados");
      return;
    }
    const st = await pedirPermissaoAvisos();
    setEstado(st);
    if (st === "ativo") {
      setAvisosLigados(true);
      setLigado(true);
      toast.success("Avisos do sistema ativados");
      mostrarAviso("Avisos ativados", "Você vai receber os alertas do CRM aqui.");
    } else if (st === "iframe") {
      toast.error("Abra o app em uma aba/janela própria para ativar os avisos.");
    } else if (st === "negado") {
      toast.error("As notificações estão bloqueadas nas configurações do navegador.");
    } else if (st === "nao-suportado") {
      toast.error("Seu navegador não suporta avisos do sistema.");
    }
  }

  async function marcarTodas() {
    const ids = itens.filter((n) => !n.lida).map((n) => n.id);
    if (!ids.length) return;
    setItens((prev) => prev.map((n) => ({ ...n, lida: true })));
    await supabase.from("notificacoes").update({ lida: true }).in("id", ids);
  }

  async function abrir(n: Notificacao) {
    if (!n.lida) {
      setItens((prev) => prev.map((x) => (x.id === n.id ? { ...x, lida: true } : x)));
      await supabase.from("notificacoes").update({ lida: true }).eq("id", n.id);
    }
    setAberto(false);
    if (n.link) nav({ to: n.link } as never);
  }

  return (
    <Popover open={aberto} onOpenChange={(v) => { setAberto(v); if (v) void carregar(); }}>
      <PopoverTrigger asChild>
        <button
          aria-label="Notificações"
          className={`relative inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors ${
            compact ? "h-10 w-10" : "h-9 w-full gap-2 px-3 text-sm justify-start"
          }`}
        >
          <Bell className="h-5 w-5 md:h-4 md:w-4" />
          {!compact && <span>Notificações</span>}
          {naoLidas > 0 && (
            <span className={`absolute ${compact ? "right-1 top-1" : "right-2 top-1.5"} flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white`}>
              {naoLidas > 9 ? "9+" : naoLidas}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(20rem,calc(100vw-1.5rem))] p-0">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
          <span className="text-sm font-semibold">Notificações</span>
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={marcarTodas} disabled={!naoLidas}>
            <Check className="mr-1 h-3 w-3" /> Marcar lidas
          </Button>
        </div>
        <button
          onClick={() => void alternarAvisos()}
          className="flex w-full items-center gap-2 border-b border-border px-3 py-2.5 text-left text-xs hover:bg-muted/50"
        >
          <BellRing className={`h-4 w-4 shrink-0 ${ligado && estado === "ativo" ? "text-primary" : "text-muted-foreground"}`} />
          <span className="min-w-0 flex-1">
            <span className="block font-medium text-foreground">
              {ligado && estado === "ativo" ? "Avisos do sistema ligados" : "Ativar avisos do sistema"}
            </span>
            <span className="block text-[11px] text-muted-foreground">
              {estado === "iframe"
                ? "Abra em uma aba própria para ativar"
                : estado === "negado"
                  ? "Bloqueado nas configurações do navegador"
                  : estado === "nao-suportado"
                    ? "Navegador sem suporte"
                    : "Alerta no celular quando algo novo chegar"}
            </span>
          </span>
        </button>
        <div className="max-h-[min(20rem,60vh)] overflow-y-auto">
          {loading && !itens.length ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : !itens.length ? (
            <p className="px-3 py-8 text-center text-xs text-muted-foreground">Nenhuma notificação por aqui.</p>
          ) : (
            itens.map((n) => (
              <button
                key={n.id}
                onClick={() => void abrir(n)}
                className={`block w-full border-b border-border px-3 py-3 text-left last:border-0 hover:bg-muted/50 ${n.lida ? "" : "bg-primary/5"}`}
              >
                <p className="text-[13px] font-medium leading-snug">{n.titulo}</p>
                {n.mensagem && <p className="mt-0.5 text-xs text-muted-foreground">{n.mensagem}</p>}
                <p className="mt-1 text-[10px] text-muted-foreground">{new Date(n.criado_em).toLocaleString("pt-BR")}</p>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default NotificacoesSino;
