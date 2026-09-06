import { useCallback, useEffect, useState } from "react";
import { Loader2, MessageSquare, History, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase as supabaseClient } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = supabaseClient as any;

export const STATUS_TRATATIVA = [
  { value: "nova", label: "Nova" },
  { value: "em_analise", label: "Em análise" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "aguardando_aluno", label: "Aguardando aluno" },
  { value: "concluida", label: "Concluída" },
  { value: "cancelada", label: "Cancelada" },
];

export const PRIORIDADES = [
  { value: "baixa", label: "Baixa" },
  { value: "normal", label: "Normal" },
  { value: "alta", label: "Alta" },
  { value: "urgente", label: "Urgente" },
];

export interface TratativaResposta {
  id: string;
  protocolo: string;
  status: string;
  prioridade: string;
  responsavel_id: string | null;
  prazo: string | null;
}

interface Comentario { id: string; autor_nome: string | null; texto: string; interno: boolean; criado_em: string }
interface Evento { id: string; campo: string; de: string | null; para: string | null; autor_nome: string | null; criado_em: string }
interface Usuario { id: string; nome: string | null; email: string }

export function TratativaPanel({
  resposta,
  onAtualizado,
}: {
  resposta: TratativaResposta;
  onAtualizado?: (r: Partial<TratativaResposta>) => void;
}) {
  const [status, setStatus] = useState(resposta.status || "nova");
  const [prioridade, setPrioridade] = useState(resposta.prioridade || "normal");
  const [responsavel, setResponsavel] = useState(resposta.responsavel_id ?? "");
  const [prazo, setPrazo] = useState(resposta.prazo ?? "");
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [texto, setTexto] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [aba, setAba] = useState<"comentarios" | "historico">("comentarios");

  useEffect(() => {
    setStatus(resposta.status || "nova");
    setPrioridade(resposta.prioridade || "normal");
    setResponsavel(resposta.responsavel_id ?? "");
    setPrazo(resposta.prazo ?? "");
  }, [resposta.id, resposta.status, resposta.prioridade, resposta.responsavel_id, resposta.prazo]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const [{ data: us }, { data: cs }, { data: es }] = await Promise.all([
      supabase.from("usuarios_crm").select("id, nome, email").eq("ativo", true).order("nome"),
      supabase.from("form_resposta_comentarios").select("*").eq("resposta_id", resposta.id).order("criado_em", { ascending: true }),
      supabase.from("form_resposta_eventos").select("*").eq("resposta_id", resposta.id).order("criado_em", { ascending: false }),
    ]);
    setUsuarios((us ?? []) as Usuario[]);
    setComentarios((cs ?? []) as Comentario[]);
    setEventos((es ?? []) as Evento[]);
    setCarregando(false);
  }, [resposta.id]);

  useEffect(() => { void carregar(); }, [carregar]);

  async function autorAtual() {
    const { data } = await supabase.auth.getUser();
    const uid = data?.user?.id ?? null;
    let nome: string | null = data?.user?.email ?? null;
    if (uid) {
      const { data: u } = await supabase.from("usuarios_crm").select("nome").eq("id", uid).maybeSingle();
      if (u?.nome) nome = u.nome;
    }
    return { uid, nome };
  }

  const rotulo = (lista: { value: string; label: string }[], v: string) => lista.find((x) => x.value === v)?.label ?? v;
  const nomeUsuario = (id: string) => usuarios.find((u) => u.id === id)?.nome ?? usuarios.find((u) => u.id === id)?.email ?? "—";

  async function salvar() {
    setSalvando(true);
    const { uid, nome } = await autorAtual();
    const mudancas: { campo: string; de: string; para: string }[] = [];
    if (status !== (resposta.status || "nova")) mudancas.push({ campo: "Status", de: rotulo(STATUS_TRATATIVA, resposta.status || "nova"), para: rotulo(STATUS_TRATATIVA, status) });
    if (prioridade !== (resposta.prioridade || "normal")) mudancas.push({ campo: "Prioridade", de: rotulo(PRIORIDADES, resposta.prioridade || "normal"), para: rotulo(PRIORIDADES, prioridade) });
    if ((responsavel || "") !== (resposta.responsavel_id ?? "")) mudancas.push({ campo: "Responsável", de: resposta.responsavel_id ? nomeUsuario(resposta.responsavel_id) : "—", para: responsavel ? nomeUsuario(responsavel) : "—" });
    if ((prazo || "") !== (resposta.prazo ?? "")) mudancas.push({ campo: "Prazo", de: resposta.prazo ?? "—", para: prazo || "—" });

    const { error } = await supabase
      .from("form_respostas")
      .update({
        status,
        prioridade,
        responsavel_id: responsavel || null,
        prazo: prazo || null,
      })
      .eq("id", resposta.id);

    if (error) {
      setSalvando(false);
      toast.error("Não foi possível salvar a tratativa");
      return;
    }

    if (mudancas.length) {
      await supabase.from("form_resposta_eventos").insert(
        mudancas.map((m) => ({ resposta_id: resposta.id, campo: m.campo, de: m.de, para: m.para, autor_id: uid, autor_nome: nome })),
      );
      if (responsavel && responsavel !== (resposta.responsavel_id ?? "")) {
        await supabase.from("notificacoes").insert({
          usuario_id: responsavel,
          tipo: "form_tratativa",
          titulo: "Você recebeu uma tratativa",
          mensagem: `Protocolo ${resposta.protocolo}`,
          link: window.location.pathname,
        });
      }
    }

    onAtualizado?.({ status, prioridade, responsavel_id: responsavel || null, prazo: prazo || null });
    setSalvando(false);
    toast.success("Tratativa atualizada");
    void carregar();
  }

  async function comentar() {
    const t = texto.trim();
    if (!t) return;
    const { uid, nome } = await autorAtual();
    const { error } = await supabase.from("form_resposta_comentarios").insert({
      resposta_id: resposta.id, texto: t, interno: true, autor_id: uid, autor_nome: nome,
    });
    if (error) { toast.error("Não foi possível salvar o comentário"); return; }
    setTexto("");
    void carregar();
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-sm font-semibold">Tratativa</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs text-muted-foreground">Status</label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_TRATATIVA.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Prioridade</label>
          <Select value={prioridade} onValueChange={setPrioridade}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PRIORIDADES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Responsável</label>
          <Select value={responsavel || "nenhum"} onValueChange={(v) => setResponsavel(v === "nenhum" ? "" : v)}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Sem responsável" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="nenhum">Sem responsável</SelectItem>
              {usuarios.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome ?? u.email}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Prazo</label>
          <Input type="date" className="mt-1" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
        </div>
      </div>
      <Button size="sm" className="mt-3" onClick={() => void salvar()} disabled={salvando}>
        {salvando && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />} Salvar tratativa
      </Button>

      <div className="mt-5 flex gap-2 border-b border-border pb-2">
        <button onClick={() => setAba("comentarios")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] ${aba === "comentarios" ? "bg-rose-50 font-medium text-rose-600" : "text-muted-foreground hover:bg-muted/40"}`}>
          <MessageSquare className="h-3.5 w-3.5" /> Comentários
        </button>
        <button onClick={() => setAba("historico")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] ${aba === "historico" ? "bg-rose-50 font-medium text-rose-600" : "text-muted-foreground hover:bg-muted/40"}`}>
          <History className="h-3.5 w-3.5" /> Histórico
        </button>
      </div>

      {carregando ? (
        <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
      ) : aba === "comentarios" ? (
        <div className="mt-3 space-y-3">
          {comentarios.length === 0 && <p className="text-xs text-muted-foreground">Nenhum comentário interno ainda.</p>}
          {comentarios.map((c) => (
            <div key={c.id} className="rounded-lg bg-muted/40 px-3 py-2">
              <p className="text-[11px] text-muted-foreground">{c.autor_nome ?? "Equipe"} · {new Date(c.criado_em).toLocaleString("pt-BR")}</p>
              <p className="mt-0.5 whitespace-pre-wrap text-sm">{c.texto}</p>
            </div>
          ))}
          <div className="flex gap-2">
            <Textarea rows={2} placeholder="Escreva um comentário interno" value={texto} onChange={(e) => setTexto(e.target.value)} />
            <Button size="icon" onClick={() => void comentar()} aria-label="Enviar comentário"><Send className="h-4 w-4" /></Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {eventos.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma alteração registrada.</p>}
          {eventos.map((e) => (
            <div key={e.id} className="text-xs">
              <span className="font-medium">{e.campo}</span>: {e.de || "—"} → {e.para || "—"}
              <span className="text-muted-foreground"> · {e.autor_nome ?? "Equipe"} · {new Date(e.criado_em).toLocaleString("pt-BR")}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default TratativaPanel;
