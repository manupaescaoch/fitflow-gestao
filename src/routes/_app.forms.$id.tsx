import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Plus, Trash2, Copy, GripVertical, Loader2, Check, AlertTriangle,
  Eye, Send, Settings2, ListChecks, Share2, Smartphone, Monitor, Undo2, Filter,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CampoResposta } from "@/components/formularios/CampoResposta";
import { CompartilharBox } from "@/components/formularios/CompartilharBox";
import {
  Formulario, Pergunta, Secao, TIPOS, TIPOS_ESTATICOS, TIPOS_OPCOES, OPERADORES,
  STATUS_LABEL, STATUS_CLASS, type Operador, type StatusFormulario, type TipoCampo,
  mapFormulario, mapPergunta, novoId, validarLogica, perguntaVisivel,
} from "@/lib/formularios";

export const Route = createFileRoute("/_app/forms/$id")({
  head: () => ({
    meta: [
      { title: "Editor de formulário — MPTEAM CRM" },
      { name: "description", content: "Monte perguntas, seções, lógica condicional e configurações de publicação do formulário." },
      { property: "og:title", content: "Editor de formulário — MPTEAM CRM" },
      { property: "og:description", content: "Monte perguntas, seções e lógica condicional do formulário." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EditorPage,
});

type Aba = "perguntas" | "config" | "previa" | "publicar";

function EditorPage() {
  const { id } = useParams({ from: "/_app/forms/$id" });
  const nav = useNavigate();

  const [form, setForm] = useState<Formulario | null>(null);
  const [secoes, setSecoes] = useState<Secao[]>([]);
  const [perguntas, setPerguntas] = useState<Pergunta[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState<"idle" | "salvando" | "salvo" | "erro">("idle");
  const [aba, setAba] = useState<Aba>("perguntas");
  const [condicaoDe, setCondicaoDe] = useState<Pergunta | null>(null);
  const [previaMobile, setPreviaMobile] = useState(false);
  const [drag, setDrag] = useState<string | null>(null);

  const sujo = useRef(false);
  const removidos = useRef<{ secoes: string[]; perguntas: string[] }>({ secoes: [], perguntas: [] });

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: f }, { data: s }, { data: p }] = await Promise.all([
      supabase.from("form_formularios").select("*").eq("id", id).maybeSingle(),
      supabase.from("form_secoes").select("*").eq("formulario_id", id).is("excluido_em", null).order("ordem"),
      supabase.from("form_perguntas").select("*").eq("formulario_id", id).is("excluido_em", null).order("ordem"),
    ]);
    if (!f) { toast.error("Formulário não encontrado"); nav({ to: "/forms" }); return; }
    setForm(mapFormulario(f as Record<string, unknown>));
    setSecoes((s ?? []) as unknown as Secao[]);
    setPerguntas(((p ?? []) as Record<string, unknown>[]).map(mapPergunta));
    setLoading(false);
  }, [id, nav]);

  useEffect(() => { void load(); }, [load]);

  const salvar = useCallback(async () => {
    if (!form) return;
    setSalvando("salvando");
    const temRespostas = form.total_respostas > 0;
    try {
      const { error: e1 } = await supabase.from("form_formularios").update({
        titulo: form.titulo, descricao: form.descricao, capa_url: form.capa_url,
        cor_primaria: form.cor_primaria, responsavel_id: form.responsavel_id,
        abre_em: form.abre_em, encerra_em: form.encerra_em, mensagem_sucesso: form.mensagem_sucesso,
        redirect_url: form.redirect_url, config: form.config, max_respostas: form.max_respostas,
      }).eq("id", form.id);
      if (e1) throw e1;

      if (secoes.length) {
        const { error } = await supabase.from("form_secoes").upsert(
          secoes.map((s, i) => ({
            id: s.id, formulario_id: form.id, ordem: i, titulo: s.titulo,
            descricao: s.descricao, destino: s.destino, destino_secao_id: s.destino_secao_id,
          })),
        );
        if (error) throw error;
      }
      if (perguntas.length) {
        const { error } = await supabase.from("form_perguntas").upsert(
          perguntas.map((p, i) => ({
            id: p.id, formulario_id: form.id, secao_id: p.secao_id, ordem: i, tipo: p.tipo,
            titulo: p.titulo, descricao: p.descricao, obrigatoria: p.obrigatoria,
            opcoes: p.opcoes, config: p.config, condicoes: p.condicoes,
          })),
        );
        if (error) throw error;
      }
      const rem = removidos.current;
      if (rem.perguntas.length) {
        if (temRespostas) await supabase.from("form_perguntas").update({ excluido_em: new Date().toISOString() }).in("id", rem.perguntas);
        else await supabase.from("form_perguntas").delete().in("id", rem.perguntas);
      }
      if (rem.secoes.length) {
        if (temRespostas) await supabase.from("form_secoes").update({ excluido_em: new Date().toISOString() }).in("id", rem.secoes);
        else await supabase.from("form_secoes").delete().in("id", rem.secoes);
      }
      removidos.current = { secoes: [], perguntas: [] };
      setSalvando("salvo");
      sujo.current = false;
    } catch {
      setSalvando("erro");
    }
  }, [form, secoes, perguntas]);

  // salvamento automático
  useEffect(() => {
    if (loading || !sujo.current) return;
    const t = setTimeout(() => { void salvar(); }, 1200);
    return () => clearTimeout(t);
  }, [form, secoes, perguntas, loading, salvar]);

  function marcar() { sujo.current = true; setSalvando("idle"); }
  function patchForm(patch: Partial<Formulario>) { setForm((f) => (f ? { ...f, ...patch } : f)); marcar(); }
  function patchConfig(patch: Record<string, unknown>) {
    setForm((f) => (f ? { ...f, config: { ...f.config, ...patch } } : f)); marcar();
  }
  function patchPergunta(pid: string, patch: Partial<Pergunta>) {
    setPerguntas((ps) => ps.map((p) => (p.id === pid ? { ...p, ...patch } : p))); marcar();
  }

  function addSecao() {
    if (!form) return;
    setSecoes((s) => [...s, {
      id: novoId(), formulario_id: form.id, ordem: s.length,
      titulo: `Seção ${s.length + 1}`, descricao: null, destino: "proxima", destino_secao_id: null,
    }]);
    marcar();
  }
  function addPergunta(secaoId: string) {
    if (!form) return;
    setPerguntas((ps) => [...ps, {
      id: novoId(), formulario_id: form.id, secao_id: secaoId, ordem: ps.length,
      tipo: "texto_curto", titulo: "Pergunta sem título", descricao: null, obrigatoria: false,
      opcoes: [], config: {}, condicoes: {},
    }]);
    marcar();
  }
  function duplicarPergunta(p: Pergunta) {
    setPerguntas((ps) => {
      const idx = ps.findIndex((x) => x.id === p.id);
      const copia = { ...p, id: novoId(), titulo: `${p.titulo} (cópia)`, condicoes: {} };
      return [...ps.slice(0, idx + 1), copia, ...ps.slice(idx + 1)];
    });
    marcar();
  }
  function removerPergunta(p: Pergunta) {
    removidos.current.perguntas.push(p.id);
    setPerguntas((ps) => ps.filter((x) => x.id !== p.id));
    marcar();
  }
  function removerSecao(s: Secao) {
    if (secoes.length === 1) { toast.error("O formulário precisa de ao menos uma seção"); return; }
    removidos.current.secoes.push(s.id);
    perguntas.filter((p) => p.secao_id === s.id).forEach((p) => removidos.current.perguntas.push(p.id));
    setPerguntas((ps) => ps.filter((p) => p.secao_id !== s.id));
    setSecoes((ss) => ss.filter((x) => x.id !== s.id));
    marcar();
  }
  function reordenar(origem: string, destino: string) {
    setPerguntas((ps) => {
      const a = ps.findIndex((p) => p.id === origem);
      const b = ps.findIndex((p) => p.id === destino);
      if (a < 0 || b < 0 || a === b) return ps;
      const copia = [...ps];
      const [item] = copia.splice(a, 1);
      copia.splice(b, 0, { ...item, secao_id: ps[b].secao_id });
      return copia;
    });
    marcar();
  }

  const erros = useMemo(() => (form ? validarLogica(secoes, perguntas) : []), [form, secoes, perguntas]);

  async function publicar() {
    if (!form) return;
    if (erros.length) { toast.error("Corrija os problemas antes de publicar"); setAba("publicar"); return; }
    await salvar();
    const { error } = await supabase.from("form_formularios")
      .update({ status: "publicado", publicado_em: form.publicado_em ?? new Date().toISOString(), config: { ...form.config, aceitar_respostas: true } })
      .eq("id", form.id);
    if (error) { toast.error("Não foi possível publicar"); return; }
    setForm({ ...form, status: "publicado", publicado_em: form.publicado_em ?? new Date().toISOString() });
    toast.success("Formulário publicado");
    setAba("publicar");
  }

  async function mudarStatus(novo: StatusFormulario) {
    if (!form) return;
    await supabase.from("form_formularios").update({ status: novo }).eq("id", form.id);
    setForm({ ...form, status: novo });
    toast.success(`Formulário ${STATUS_LABEL[novo].toLowerCase()}`);
  }

  if (loading || !form) {
    return <div className="flex items-center justify-center py-24 text-muted-foreground">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando editor…
    </div>;
  }

  const cor = form.cor_primaria;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => nav({ to: "/forms" })}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Formulários
        </Button>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_CLASS[form.status]}`}>
          {STATUS_LABEL[form.status]}
        </span>
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          {salvando === "salvando" && <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando…</>}
          {salvando === "salvo" && <><Check className="h-3.5 w-3.5 text-emerald-600" /> Alterações salvas</>}
          {salvando === "erro" && <><AlertTriangle className="h-3.5 w-3.5 text-destructive" /> Erro ao salvar</>}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-b border-border pb-3">
        {([["perguntas", "Perguntas", ListChecks], ["config", "Configurações", Settings2], ["previa", "Prévia", Eye], ["publicar", "Publicar", Share2]] as const)
          .map(([k, label, Icon]) => (
            <button key={k} onClick={() => setAba(k)}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-[13px] transition-colors ${
                aba === k ? "bg-rose-50 font-medium text-rose-600" : "text-muted-foreground hover:bg-muted/40"}`}>
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { void salvar(); toast.success("Rascunho salvo"); }}>Salvar rascunho</Button>
          <Button variant="outline" size="sm" onClick={() => { removidos.current = { secoes: [], perguntas: [] }; void load(); toast.success("Alterações canceladas"); }}>
            <Undo2 className="mr-2 h-3.5 w-3.5" /> Cancelar alterações
          </Button>
          <Button size="sm" onClick={() => void publicar()}><Send className="mr-2 h-3.5 w-3.5" /> Publicar</Button>
        </div>
      </div>

      {aba === "perguntas" && (
        <div className="mt-5 space-y-5">
          <div className="rounded-xl border border-border bg-card p-4" style={{ borderTopColor: cor, borderTopWidth: 4 }}>
            <Input className="border-0 px-0 text-lg font-semibold shadow-none focus-visible:ring-0"
              value={form.titulo} onChange={(e) => patchForm({ titulo: e.target.value })} placeholder="Título do formulário" />
            <Textarea className="mt-1 border-0 px-0 shadow-none focus-visible:ring-0" rows={2}
              value={form.descricao ?? ""} onChange={(e) => patchForm({ descricao: e.target.value })}
              placeholder="Descrição do formulário" />
          </div>

          {secoes.map((s, si) => (
            <div key={s.id} className="space-y-3">
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Seção {si + 1} de {secoes.length}</span>
                  <Button variant="ghost" size="icon" className="ml-auto h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => removerSecao(s)} aria-label="Excluir seção"><Trash2 className="h-4 w-4" /></Button>
                </div>
                <Input className="mt-2 bg-background" value={s.titulo} placeholder="Título da seção"
                  onChange={(e) => { setSecoes((ss) => ss.map((x) => x.id === s.id ? { ...x, titulo: e.target.value } : x)); marcar(); }} />
                <Input className="mt-2 bg-background" value={s.descricao ?? ""} placeholder="Descrição da seção (opcional)"
                  onChange={(e) => { setSecoes((ss) => ss.map((x) => x.id === s.id ? { ...x, descricao: e.target.value } : x)); marcar(); }} />
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Depois desta seção:</span>
                  <select className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                    value={s.destino}
                    onChange={(e) => { setSecoes((ss) => ss.map((x) => x.id === s.id ? { ...x, destino: e.target.value as Secao["destino"] } : x)); marcar(); }}>
                    <option value="proxima">Seguir para a próxima seção</option>
                    <option value="secao">Ir para uma seção específica</option>
                    <option value="encerrar">Encerrar o formulário</option>
                  </select>
                  {s.destino === "secao" && (
                    <select className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                      value={s.destino_secao_id ?? ""}
                      onChange={(e) => { setSecoes((ss) => ss.map((x) => x.id === s.id ? { ...x, destino_secao_id: e.target.value || null } : x)); marcar(); }}>
                      <option value="">Selecione…</option>
                      {secoes.filter((o) => o.id !== s.id).map((o, i) => <option key={o.id} value={o.id}>{i + 1}. {o.titulo}</option>)}
                    </select>
                  )}
                </div>
              </div>

              {perguntas.filter((p) => p.secao_id === s.id).map((p) => (
                <div key={p.id} draggable onDragStart={() => setDrag(p.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => { if (drag && drag !== p.id) reordenar(drag, p.id); setDrag(null); }}
                  className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-start gap-2">
                    <GripVertical className="mt-2 h-4 w-4 shrink-0 cursor-grab text-muted-foreground" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Input className="flex-1" value={p.titulo} placeholder="Pergunta"
                          onChange={(e) => patchPergunta(p.id, { titulo: e.target.value })} />
                        <select className="h-10 rounded-md border border-input bg-background px-2 text-sm sm:w-56"
                          value={p.tipo}
                          onChange={(e) => patchPergunta(p.id, {
                            tipo: e.target.value as TipoCampo,
                            opcoes: TIPOS_OPCOES.includes(e.target.value as TipoCampo) && !p.opcoes.length
                              ? [{ id: novoId(), label: "Opção 1" }] : p.opcoes,
                          })}>
                          {[...new Set(TIPOS.map((t) => t.grupo))].map((g) => (
                            <optgroup key={g} label={g}>
                              {TIPOS.filter((t) => t.grupo === g).map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </optgroup>
                          ))}
                        </select>
                      </div>
                      <Input value={p.descricao ?? ""} placeholder="Descrição ou orientação (opcional)"
                        onChange={(e) => patchPergunta(p.id, { descricao: e.target.value })} />

                      {TIPOS_OPCOES.includes(p.tipo) && (
                        <div className="space-y-1.5">
                          {p.opcoes.map((o) => (
                            <div key={o.id} className="flex items-center gap-2">
                              <Input value={o.label}
                                onChange={(e) => patchPergunta(p.id, { opcoes: p.opcoes.map((x) => x.id === o.id ? { ...x, label: e.target.value } : x) })} />
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => patchPergunta(p.id, { opcoes: p.opcoes.filter((x) => x.id !== o.id) })}
                                aria-label="Remover opção"><Trash2 className="h-3.5 w-3.5" /></Button>
                            </div>
                          ))}
                          <Button variant="ghost" size="sm"
                            onClick={() => patchPergunta(p.id, { opcoes: [...p.opcoes, { id: novoId(), label: `Opção ${p.opcoes.length + 1}` }] })}>
                            <Plus className="mr-2 h-3.5 w-3.5" /> Adicionar opção
                          </Button>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1 text-xs text-muted-foreground">
                        {!TIPOS_ESTATICOS.includes(p.tipo) && (
                          <label className="flex items-center gap-2">
                            <Switch checked={p.obrigatoria} onCheckedChange={(v) => patchPergunta(p.id, { obrigatoria: v })} />
                            Obrigatória
                          </label>
                        )}
                        {TIPOS_OPCOES.includes(p.tipo) && (
                          <label className="flex items-center gap-2">
                            <Switch checked={!!p.config.permitirOutro}
                              onCheckedChange={(v) => patchPergunta(p.id, { config: { ...p.config, permitirOutro: v } })} />
                            Opção “Outro”
                          </label>
                        )}
                        {p.tipo === "arquivo" && (
                          <label className="flex items-center gap-2">
                            <Switch checked={!!p.config.multiplos}
                              onCheckedChange={(v) => patchPergunta(p.id, { config: { ...p.config, multiplos: v } })} />
                            Vários arquivos
                          </label>
                        )}
                        {(p.tipo === "numero" || p.tipo === "caixas") && (
                          <span className="flex items-center gap-1">
                            Mín.
                            <Input className="h-7 w-16" type="number" value={p.config.min ?? ""}
                              onChange={(e) => patchPergunta(p.id, { config: { ...p.config, min: e.target.value === "" ? null : Number(e.target.value) } })} />
                            Máx.
                            <Input className="h-7 w-16" type="number" value={p.config.max ?? ""}
                              onChange={(e) => patchPergunta(p.id, { config: { ...p.config, max: e.target.value === "" ? null : Number(e.target.value) } })} />
                          </span>
                        )}
                        {(p.tipo === "escala" || p.tipo === "estrelas") && (
                          <span className="flex items-center gap-1">
                            De
                            <Input className="h-7 w-14" type="number" value={p.config.escalaMin ?? 1}
                              onChange={(e) => patchPergunta(p.id, { config: { ...p.config, escalaMin: Number(e.target.value) } })} />
                            até
                            <Input className="h-7 w-14" type="number" value={p.config.escalaMax ?? 5}
                              onChange={(e) => patchPergunta(p.id, { config: { ...p.config, escalaMax: Number(e.target.value) } })} />
                          </span>
                        )}
                        <button className="flex items-center gap-1.5 hover:text-foreground" onClick={() => setCondicaoDe(p)}>
                          <Filter className="h-3.5 w-3.5" />
                          {p.condicoes?.modo === "se" ? "Regra condicional ativa" : "Definir condição"}
                        </button>
                        <button className="ml-auto flex items-center gap-1.5 hover:text-foreground" onClick={() => duplicarPergunta(p)}>
                          <Copy className="h-3.5 w-3.5" /> Duplicar
                        </button>
                        <button className="flex items-center gap-1.5 hover:text-destructive" onClick={() => removerPergunta(p)}>
                          <Trash2 className="h-3.5 w-3.5" /> Excluir
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <Button variant="outline" size="sm" onClick={() => addPergunta(s.id)}>
                <Plus className="mr-2 h-4 w-4" /> Adicionar pergunta
              </Button>
            </div>
          ))}

          <Button variant="outline" onClick={addSecao}><Plus className="mr-2 h-4 w-4" /> Adicionar seção</Button>
        </div>
      )}

      {aba === "config" && (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="space-y-3 rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">Identificação</h2>
            <Campo label="Imagem de capa (URL)">
              <Input value={form.capa_url ?? ""} onChange={(e) => patchForm({ capa_url: e.target.value })} placeholder="https://…" />
            </Campo>
            <Campo label="Cor principal">
              <input type="color" className="h-10 w-16 rounded border border-input bg-background"
                value={form.cor_primaria} onChange={(e) => patchForm({ cor_primaria: e.target.value })} />
            </Campo>
            <Campo label="Setor responsável">
              <Input value={form.config.setor ?? ""} onChange={(e) => patchConfig({ setor: e.target.value })} placeholder="Ex.: Nutrição" />
            </Campo>
            <Campo label="Mensagem após o envio">
              <Textarea rows={3} value={form.mensagem_sucesso} onChange={(e) => patchForm({ mensagem_sucesso: e.target.value })} />
            </Campo>
            <Campo label="Redirecionar após o envio (opcional)">
              <Input value={form.redirect_url ?? ""} onChange={(e) => patchForm({ redirect_url: e.target.value })} placeholder="https://…" />
            </Campo>
          </div>

          <div className="space-y-3 rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">Período e limites</h2>
            <Campo label="Data de abertura">
              <Input type="datetime-local" value={toLocal(form.abre_em)} onChange={(e) => patchForm({ abre_em: fromLocal(e.target.value) })} />
            </Campo>
            <Campo label="Data de encerramento">
              <Input type="datetime-local" value={toLocal(form.encerra_em)} onChange={(e) => patchForm({ encerra_em: fromLocal(e.target.value) })} />
            </Campo>
            <Campo label="Máximo de respostas">
              <Input type="number" value={form.max_respostas ?? ""} placeholder="Sem limite"
                onChange={(e) => patchForm({ max_respostas: e.target.value === "" ? null : Number(e.target.value) })} />
            </Campo>
            <h2 className="pt-2 text-sm font-semibold">Respostas</h2>
            {([
              ["aceitar_respostas", "Aceitar novas respostas"],
              ["exigir_identificacao", "Exigir identificação"],
              ["permitir_anonimo", "Permitir resposta anônima"],
              ["coletar_nome", "Coletar nome"],
              ["coletar_email", "Coletar e-mail"],
              ["coletar_telefone", "Coletar telefone"],
              ["uma_resposta_por_pessoa", "Uma resposta por pessoa"],
              ["permitir_editar", "Permitir editar após o envio"],
              ["barra_progresso", "Exibir barra de progresso"],
              ["embaralhar_perguntas", "Embaralhar perguntas"],
              ["embaralhar_alternativas", "Embaralhar alternativas"],
              ["enviar_copia", "Enviar cópia ao respondente"],
              ["gerar_protocolo", "Gerar protocolo após o envio"],
            ] as const).map(([k, label]) => (
              <label key={k} className="flex items-center justify-between gap-3 text-sm">
                <span>{label}</span>
                <Switch checked={!!form.config[k]} onCheckedChange={(v) => patchConfig({ [k]: v })} />
              </label>
            ))}
          </div>
        </div>
      )}

      {aba === "previa" && (
        <div className="mt-5">
          <div className="mb-3 flex gap-2">
            <Button variant={previaMobile ? "outline" : "default"} size="sm" onClick={() => setPreviaMobile(false)}>
              <Monitor className="mr-2 h-3.5 w-3.5" /> Computador
            </Button>
            <Button variant={previaMobile ? "default" : "outline"} size="sm" onClick={() => setPreviaMobile(true)}>
              <Smartphone className="mr-2 h-3.5 w-3.5" /> Celular
            </Button>
          </div>
          <div className={`mx-auto rounded-xl border border-border bg-card p-5 ${previaMobile ? "max-w-[380px]" : ""}`}>
            <h2 className="text-lg font-bold" style={{ color: cor }}>{form.titulo}</h2>
            {form.descricao && <p className="mt-1 text-sm text-muted-foreground">{form.descricao}</p>}
            <div className="mt-5 space-y-5">
              {perguntas.filter((p) => perguntaVisivel(p, {})).map((p) => (
                <CampoResposta key={p.id} pergunta={p} valor={undefined} onChange={() => {}} cor={cor} disabled />
              ))}
            </div>
          </div>
        </div>
      )}

      {aba === "publicar" && (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="space-y-3 rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">Situação</h2>
            <div className="flex flex-wrap gap-2">
              {(["publicado", "pausado", "encerrado", "arquivado", "rascunho"] as StatusFormulario[]).map((s) => (
                <Button key={s} size="sm" variant={form.status === s ? "default" : "outline"} onClick={() => void mudarStatus(s)}>
                  {STATUS_LABEL[s]}
                </Button>
              ))}
            </div>
            {erros.length > 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                <p className="mb-1 flex items-center gap-1.5 font-semibold"><AlertTriangle className="h-3.5 w-3.5" /> Problemas encontrados</p>
                <ul className="list-disc space-y-0.5 pl-4">{erros.map((e) => <li key={e}>{e}</li>)}</ul>
              </div>
            ) : (
              <p className="text-xs text-emerald-700">Nenhum problema de lógica encontrado.</p>
            )}
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold">Compartilhar</h2>
            {form.status === "rascunho"
              ? <p className="text-xs text-muted-foreground">Publique o formulário para gerar o link público e o QR Code.</p>
              : <CompartilharBox slug={form.slug} titulo={form.titulo} />}
          </div>
        </div>
      )}

      <Dialog open={!!condicaoDe} onOpenChange={(o) => !o && setCondicaoDe(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Lógica condicional</DialogTitle></DialogHeader>
          {condicaoDe && (
            <CondicoesEditor
              pergunta={perguntas.find((p) => p.id === condicaoDe.id) ?? condicaoDe}
              anteriores={perguntas.slice(0, perguntas.findIndex((p) => p.id === condicaoDe.id)).filter((p) => !TIPOS_ESTATICOS.includes(p.tipo))}
              onChange={(c) => patchPergunta(condicaoDe.id, { condicoes: c })}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="text-xs font-medium text-muted-foreground">{label}</label><div className="mt-1">{children}</div></div>;
}

function toLocal(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}
function fromLocal(v: string) { return v ? new Date(v).toISOString() : null; }

function CondicoesEditor({ pergunta, anteriores, onChange }: {
  pergunta: Pergunta;
  anteriores: Pergunta[];
  onChange: (c: Pergunta["condicoes"]) => void;
}) {
  const cond = pergunta.condicoes ?? {};
  const regras = cond.regras ?? [];
  const set = (patch: Partial<Pergunta["condicoes"]>) => onChange({ ...cond, ...patch });

  return (
    <div className="space-y-4">
      <label className="flex items-center justify-between text-sm">
        <span>Mostrar esta pergunta somente quando…</span>
        <Switch checked={cond.modo === "se"}
          onCheckedChange={(v) => set({ modo: v ? "se" : "sempre", regras: v && !regras.length ? [{ perguntaId: anteriores[0]?.id ?? "", op: "igual", valor: "" }] : regras })} />
      </label>

      {cond.modo === "se" && (
        <>
          {anteriores.length === 0 && (
            <p className="text-xs text-muted-foreground">Adicione perguntas antes desta para poder criar condições.</p>
          )}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Combinar condições com:</span>
            <select className="h-8 rounded-md border border-input bg-background px-2"
              value={cond.logica ?? "E"} onChange={(e) => set({ logica: e.target.value as "E" | "OU" })}>
              <option value="E">E (todas)</option>
              <option value="OU">OU (qualquer uma)</option>
            </select>
          </div>
          <div className="space-y-2">
            {regras.map((r, i) => (
              <div key={i} className="grid gap-2 rounded-lg border border-border p-2 sm:grid-cols-[1fr_auto]">
                <div className="space-y-2">
                  <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                    value={r.perguntaId}
                    onChange={(e) => set({ regras: regras.map((x, j) => j === i ? { ...x, perguntaId: e.target.value } : x) })}>
                    <option value="">Selecione a pergunta…</option>
                    {anteriores.map((p) => <option key={p.id} value={p.id}>{p.titulo}</option>)}
                  </select>
                  <div className="flex gap-2">
                    <select className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                      value={r.op} onChange={(e) => set({ regras: regras.map((x, j) => j === i ? { ...x, op: e.target.value as Operador } : x) })}>
                      {OPERADORES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <Input className="h-9" placeholder="Valor" value={r.valor}
                      onChange={(e) => set({ regras: regras.map((x, j) => j === i ? { ...x, valor: e.target.value } : x) })} />
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-destructive"
                  onClick={() => set({ regras: regras.filter((_, j) => j !== i) })} aria-label="Remover condição">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm"
              onClick={() => set({ regras: [...regras, { perguntaId: anteriores[0]?.id ?? "", op: "igual", valor: "" }] })}>
              <Plus className="mr-2 h-3.5 w-3.5" /> Adicionar condição
            </Button>
          </div>
          <label className="flex items-center justify-between text-sm">
            <span>Tornar obrigatória apenas quando a condição for atendida</span>
            <Switch checked={!!cond.obrigatoriaSeCondicao} onCheckedChange={(v) => set({ obrigatoriaSeCondicao: v })} />
          </label>
        </>
      )}
    </div>
  );
}
