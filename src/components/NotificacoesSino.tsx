import { useCallback, useEffect, useState } from "react";
import { Bell, Check, Loader2 } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { supabase as supabaseClient } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

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
    setItens((data ?? []) as Notificacao[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void carregar();
    const t = setInterval(() => void carregar(), 60_000);
    return () => clearInterval(t);
  }, [carregar]);

  const naoLidas = itens.filter((n) => !n.lida).length;

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
            compact ? "h-9 w-9" : "h-9 w-full gap-2 px-3 text-sm justify-start"
          }`}
        >
          <Bell className="h-4 w-4" />
          {!compact && <span>Notificações</span>}
          {naoLidas > 0 && (
            <span className={`absolute ${compact ? "right-1 top-1" : "right-2 top-1.5"} flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white`}>
              {naoLidas > 9 ? "9+" : naoLidas}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[320px] p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-sm font-semibold">Notificações</span>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={marcarTodas} disabled={!naoLidas}>
            <Check className="mr-1 h-3 w-3" /> Marcar lidas
          </Button>
        </div>
        <div className="max-h-[320px] overflow-y-auto">
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
                className={`block w-full border-b border-border px-3 py-2.5 text-left last:border-0 hover:bg-muted/50 ${n.lida ? "" : "bg-rose-50/60"}`}
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
