import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Plus, Search, Loader2, Pencil, Eye, BarChart3, Share2, Copy, Pause, Play,
  Archive, Trash2, LayoutGrid, Table as TableIcon, FileText, MoreHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { supabase as supabaseClient } from "@/integrations/supabase/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = supabaseClient as any;
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Formulario, STATUS_CLASS, STATUS_LABEL, StatusFormulario, linkPublico, mapFormulario,
} from "@/lib/formularios";
import { CompartilharBox } from "@/components/formularios/CompartilharBox";

export const Route = createFileRoute("/_app/forms/")({
  head: () => ({
    meta: [
      { title: "Formulários — MPTEAM CRM" },
      { name: "description", content: "Crie, publique e acompanhe formulários online do MPTEAM: perguntas, lógica condicional, link público e respostas." },
      { property: "og:title", content: "Formulários — MPTEAM CRM" },
      { property: "og:description", content: "Crie, publique e acompanhe formulários online do MPTEAM." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FormulariosPage,
});

const STATUS_OPCOES: StatusFormulario[] = ["rascunho", "publicado", "pausado", "encerrado", "arquivado"];

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function FormulariosPage() {
  const { crmUser } = useAuth();
  const nav = useNavigate();
  const [items, setItems] = useState<Formulario[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("todos");
  const [autor, setAutor] = useState<string>("todos");
  const [ordem, setOrdem] = useState<"recentes" | "nome" | "respostas">("recentes");
  const [modo, setModo] = useState<"cards" | "tabela">("cards");
  const [compartilhar, setCompartilhar] = useState<Formulario | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("form_formularios").select("*").is("excluido_em", null)
      .order("atualizado_em", { ascending: false });
    if (error) toast.error("Não foi possível carregar os formulários");
    setItems(((data ?? []) as Record<string, unknown>[]).map(mapFormulario));
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  const autores = useMemo(
    () => [...new Set(items.map((i) => i.autor_nome).filter(Boolean) as string[])],
    [items],
  );

  const filtrados = useMemo(() => {
    const nq = q.trim().toLowerCase();
    let out = items.filter((f) =>
      (!nq || f.titulo.toLowerCase().includes(nq)) &&
      (status === "todos" || f.status === status) &&
      (autor === "todos" || f.autor_nome === autor));
    out = [...out].sort((a, b) =>
      ordem === "nome" ? a.titulo.localeCompare(b.titulo)
      : ordem === "respostas" ? b.total_respostas - a.total_respostas
      : +new Date(b.atualizado_em) - +new Date(a.atualizado_em));
    return out;
  }, [items, q, status, autor, ordem]);

  async function criar() {
    const { data, error } = await supabase.from("form_formularios")
      .insert({ titulo: "Novo formulário", autor_id: crmUser?.id ?? null, autor_nome: crmUser?.nome ?? crmUser?.email ?? null })
      .select("id").single();
    if (error || !data) { toast.error("Erro ao criar formulário"); return; }
    const { data: sec } = await supabase.from("form_secoes")
      .insert({ formulario_id: data.id, titulo: "Seção 1", ordem: 0 }).select("id").single();
    if (sec) {
      await supabase.from("form_perguntas").insert({
        formulario_id: data.id, secao_id: sec.id, ordem: 0, tipo: "texto_curto", titulo: "Pergunta sem título",
      });
    }
    nav({ to: "/forms/$id", params: { id: data.id } });
  }

  async function mudarStatus(f: Formulario, novo: StatusFormulario) {
    const patch: Record<string, unknown> = { status: novo };
    if (novo === "publicado" && !f.publicado_em) patch["publicado_em"] = new Date().toISOString();
    const { error } = await supabase.from("form_formularios").update(patch).eq("id", f.id);
    if (error) { toast.error("Não foi possível alterar a situação"); return; }
    toast.success(`Formulário ${STATUS_LABEL[novo].toLowerCase()}`);
    void load();
  }

  async function duplicar(f: Formulario) {
    const { data: novo, error } = await supabase.from("form_formularios").insert({
      titulo: `${f.titulo} (cópia)`, descricao: f.descricao, capa_url: f.capa_url,
      cor_primaria: f.cor_primaria, mensagem_sucesso: f.mensagem_sucesso, config: f.config,
      autor_id: crmUser?.id ?? null, autor_nome: crmUser?.nome ?? crmUser?.email ?? null,
    }).select("id").single();
    if (error || !novo) { toast.error("Erro ao duplicar"); return; }
    const { data: secs } = await supabase.from("form_secoes").select("*").eq("formulario_id", f.id).is("excluido_em", null).order("ordem");
    const mapaSecoes = new Map<string, string>();
    for (const s of (secs ?? []) as Record<string, unknown>[]) {
      const { data: ns } = await supabase.from("form_secoes").insert({
        formulario_id: novo.id, titulo: s["titulo"] as string, descricao: s["descricao"] as string | null,
        ordem: s["ordem"] as number, destino: s["destino"] as string,
      }).select("id").single();
      if (ns) mapaSecoes.set(s["id"] as string, ns.id);
    }
    const { data: pergs } = await supabase.from("form_perguntas").select("*").eq("formulario_id", f.id).is("excluido_em", null).order("ordem");
    for (const p of (pergs ?? []) as Record<string, unknown>[]) {
      await supabase.from("form_perguntas").insert({
        formulario_id: novo.id, secao_id: mapaSecoes.get(p["secao_id"] as string) ?? null,
        ordem: p["ordem"] as number, tipo: p["tipo"] as string, titulo: p["titulo"] as string,
        descricao: p["descricao"] as string | null, obrigatoria: p["obrigatoria"] as boolean,
        opcoes: p["opcoes"], config: p["config"], condicoes: {},
      });
    }
    toast.success("Formulário duplicado");
    void load();
  }

  async function excluir(f: Formulario) {
    if (f.total_respostas > 0) {
      await supabase.from("form_formularios").update({ status: "arquivado", excluido_em: new Date().toISOString() }).eq("id", f.id);
      toast.success("Formulário arquivado (as respostas foram preservadas)");
    } else {
      await supabase.from("form_formularios").delete().eq("id", f.id);
      toast.success("Formulário excluído");
    }
    void load();
  }

  const acoes = (f: Formulario) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onClick={() => nav({ to: "/forms/$id", params: { id: f.id } })}>
          <Pencil className="mr-2 h-4 w-4" /> Editar
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => window.open(linkPublico(f.slug), "_blank")}>
          <Eye className="mr-2 h-4 w-4" /> Visualizar
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => nav({ to: "/forms/$id/respostas", params: { id: f.id } })}>
          <BarChart3 className="mr-2 h-4 w-4" /> Respostas
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setCompartilhar(f)}>
          <Share2 className="mr-2 h-4 w-4" /> Compartilhar
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void duplicar(f)}>
          <Copy className="mr-2 h-4 w-4" /> Duplicar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {f.status === "publicado" ? (
          <DropdownMenuItem onClick={() => void mudarStatus(f, "pausado")}>
            <Pause className="mr-2 h-4 w-4" /> Pausar
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => void mudarStatus(f, "publicado")}>
            <Play className="mr-2 h-4 w-4" /> Publicar
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => void mudarStatus(f, "arquivado")}>
          <Archive className="mr-2 h-4 w-4" /> Arquivar
        </DropdownMenuItem>
        <DropdownMenuItem className="text-destructive" onClick={() => void excluir(f)}>
          <Trash2 className="mr-2 h-4 w-4" /> Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight md:text-2xl">Formulários</h1>
          <p className="text-sm text-muted-foreground">Crie, publique e acompanhe formulários online.</p>
        </div>
        <Button onClick={() => void criar()}><Plus className="mr-2 h-4 w-4" /> Novo formulário</Button>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por nome" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="todos">Todas as situações</option>
          {STATUS_OPCOES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <select className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={autor} onChange={(e) => setAutor(e.target.value)}>
          <option value="todos">Todos os autores</option>
          {autores.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={ordem} onChange={(e) => setOrdem(e.target.value as typeof ordem)}>
          <option value="recentes">Mais recentes</option>
          <option value="nome">Nome</option>
          <option value="respostas">Nº de respostas</option>
        </select>
        <div className="flex rounded-md border border-input">
          <button className={`px-2.5 py-2 ${modo === "cards" ? "text-rose-600" : "text-muted-foreground"}`}
            onClick={() => setModo("cards")} aria-label="Ver em cards"><LayoutGrid className="h-4 w-4" /></button>
          <button className={`px-2.5 py-2 ${modo === "tabela" ? "text-rose-600" : "text-muted-foreground"}`}
            onClick={() => setModo("tabela")} aria-label="Ver em tabela"><TableIcon className="h-4 w-4" /></button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando…
        </div>
      ) : filtrados.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-border py-16 text-center">
          <FileText className="mx-auto h-8 w-8 text-muted-foreground/60" />
          <p className="mt-3 text-sm font-medium">Nenhum formulário encontrado</p>
          <p className="text-xs text-muted-foreground">Crie o primeiro formulário para começar a receber respostas.</p>
          <Button className="mt-4" size="sm" onClick={() => void criar()}><Plus className="mr-2 h-4 w-4" /> Novo formulário</Button>
        </div>
      ) : modo === "cards" ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtrados.map((f) => (
            <div key={f.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <Link to="/forms/$id" params={{ id: f.id }} className="text-sm font-semibold hover:text-rose-600">
                  {f.titulo}
                </Link>
                {acoes(f)}
              </div>
              <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_CLASS[f.status]}`}>
                {STATUS_LABEL[f.status]}
              </span>
              <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                <div>Autor: {f.autor_nome ?? "—"}</div>
                <div>Criado em {fmt(f.criado_em)}</div>
                <div>{f.total_respostas} resposta(s) · última em {fmt(f.ultima_resposta_em)}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-5 overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">Formulário</th><th className="px-4 py-2.5">Situação</th>
                <th className="px-4 py-2.5">Autor</th><th className="px-4 py-2.5">Criado</th>
                <th className="px-4 py-2.5">Respostas</th><th className="px-4 py-2.5">Última</th><th />
              </tr>
            </thead>
            <tbody>
              {filtrados.map((f) => (
                <tr key={f.id} className="border-t border-border">
                  <td className="px-4 py-2.5">
                    <Link to="/forms/$id" params={{ id: f.id }} className="font-medium hover:text-rose-600">{f.titulo}</Link>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_CLASS[f.status]}`}>{STATUS_LABEL[f.status]}</span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{f.autor_nome ?? "—"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{fmt(f.criado_em)}</td>
                  <td className="px-4 py-2.5">{f.total_respostas}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{fmt(f.ultima_resposta_em)}</td>
                  <td className="px-2 py-2.5 text-right">{acoes(f)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!compartilhar} onOpenChange={(o) => !o && setCompartilhar(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Compartilhar formulário</DialogTitle></DialogHeader>
          {compartilhar && <CompartilharBox slug={compartilhar.slug} titulo={compartilhar.titulo} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
