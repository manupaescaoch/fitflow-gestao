import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  getWorkflowConfig, saveWorkflowConfig,
  getPromptsIA, savePromptIA, testarPromptIA,
  getResumoDisparos, getHistoricoDisparos, reenviarJob,
} from "@/server/workflow.functions";
import {
  listMensagensVariantes, saveMensagensVariantes,
} from "@/server/mensagens-variantes.functions";
import {
  Power, Clock, MessageSquare, Sparkles, History,
  Loader2, Save, RefreshCw, Send, AlertCircle, CheckCircle2, X, Play, Plus, Trash2, Shuffle,
} from "lucide-react";

type ConfigItem = {
  chave: string; valor: string | null; tipo: string; secao: string;
  atualizado_em: string; atualizado_por_nome: string | null;
};

type PromptItem = { tipo: string; prompt_sistema: string; atualizado_em: string };

const PROMPT_LABELS: Record<string, { titulo: string; desc: string; placeholder: string }> = {
  anamnese: { titulo: "Resposta da Anamnese", desc: "Como a IA responde após receber a anamnese inicial.", placeholder: "Você é um treinador..." },
  feedback_quinzenal: { titulo: "Resposta do Feedback Quinzenal", desc: "Mensagem gerada para responder o feedback quinzenal.", placeholder: "Você é um treinador..." },
  feedback_mensal: { titulo: "Resposta do Feedback Mensal", desc: "Mensagem gerada para responder o feedback mensal (check shape).", placeholder: "Você é um treinador..." },
  check_shape_mensal: { titulo: "Check Shape Mensal", desc: "Prompt usado para gerar a análise das fotos antes/depois (comparativo mensal).", placeholder: "Você é um especialista em avaliação física visual por fotos de antes e depois..." },
  followup_d7: { titulo: "Follow-up D+N1", desc: "Mensagem do primeiro follow-up do ciclo.", placeholder: "Escreva uma mensagem curta..." },
  followup_d21: { titulo: "Follow-up D+N2", desc: "Mensagem do segundo follow-up do ciclo.", placeholder: "Escreva uma mensagem curta..." },
  estrategia_treino: { titulo: "Estratégia de Treino", desc: "Prompt usado para gerar a estratégia de treino do aluno.", placeholder: "Você é um treinador especialista em montar estratégias de treino..." },
  estrategia_nutricional: { titulo: "Estratégia Nutricional", desc: "Prompt usado para gerar a estratégia nutricional do aluno.", placeholder: "Você é um nutricionista especialista em montar estratégias nutricionais..." },
};

export function WorkflowSection() {
  const fetchConfig = useServerFn(getWorkflowConfig);
  const fetchPrompts = useServerFn(getPromptsIA);
  const [itens, setItens] = useState<ConfigItem[]>([]);
  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [c, p] = await Promise.all([fetchConfig(), fetchPrompts()]);
      setItens(c.itens as ConfigItem[]);
      setPrompts(p.prompts as PromptItem[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao carregar");
    } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const getItem = (chave: string) => itens.find((i) => i.chave === chave);

  if (loading) {
    return <div className="flex items-center justify-center py-16 text-sm text-muted-foreground gap-2">
      <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
    </div>;
  }

  return (
    <div className="space-y-6">
      <MotorCard item={getItem("MOTOR_ATIVO")} onSaved={load} />
      <CicloCard
        items={itens.filter((i) => i.secao === "ciclo")}
        onSaved={load}
      />
      <MensagensFixasCard
        items={itens.filter((i) => i.secao === "mensagens")}
        onSaved={load}
      />
      <PromptsIACard
        prompts={prompts.filter((p) => ["feedback_quinzenal","feedback_mensal"].includes(p.tipo))}
        onSaved={load}
      />
      <HistoricoCard />
    </div>
  );
}

/* ======================= MOTOR ======================= */
function MotorCard({ item, onSaved }: { item?: ConfigItem; onSaved: () => void }) {
  const save = useServerFn(saveWorkflowConfig);
  const ativo = item?.valor === "true";
  const [saving, setSaving] = useState(false);

  const toggle = async () => {
    setSaving(true);
    try {
      await save({ data: { secao: "motor", valores: { MOTOR_ATIVO: ativo ? "false" : "true" } } });
      toast.success(ativo ? "Motor pausado" : "Motor ativado");
      onSaved();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao salvar"); }
    finally { setSaving(false); }
  };

  return (
    <SectionCard
      icon={Power}
      title="Motor de Automação"
      desc="Liga ou desliga todas as automações: follow-ups, envios de feedbacks e respostas IA."
      ultima={item}
    >
      <div className="flex items-center gap-4">
        <button
          onClick={toggle}
          disabled={saving}
          className={`relative inline-flex h-9 w-16 items-center rounded-full transition-colors disabled:opacity-50 ${ativo ? "bg-emerald-500" : "bg-muted"}`}
        >
          <span className={`inline-block h-7 w-7 rounded-full bg-white shadow transition-transform ${ativo ? "translate-x-8" : "translate-x-1"}`} />
        </button>
        {ativo ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-sm font-medium text-emerald-600">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Sistema rodando
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/15 px-3 py-1 text-sm font-medium text-destructive">
            <X className="h-3 w-3" /> Sistema pausado
          </span>
        )}
      </div>
    </SectionCard>
  );
}

/* ======================= CICLO ======================= */
function CicloCard({ items, onSaved }: { items: ConfigItem[]; onSaved: () => void }) {
  const save = useServerFn(saveWorkflowConfig);
  const initial = useMemo(() => Object.fromEntries(items.map((i) => [i.chave, i.valor ?? ""])), [items]);
  const [vals, setVals] = useState<Record<string, string>>(initial);
  const [saving, setSaving] = useState(false);
  useEffect(() => setVals(initial), [initial]);
  const dirty = JSON.stringify(vals) !== JSON.stringify(initial);

  const handleSave = async () => {
    setSaving(true);
    try {
      await save({ data: { secao: "ciclo", valores: vals } });
      toast.success("Configurações de ciclo salvas");
      onSaved();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao salvar"); }
    finally { setSaving(false); }
  };

  const numField = (chave: string, label: string) => (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <input
        type="number" min={1} max={365}
        value={vals[chave] ?? ""}
        onChange={(e) => setVals({ ...vals, [chave]: e.target.value })}
        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
    </div>
  );

  return (
    <SectionCard
      icon={Clock}
      title="Ciclo de Disparos"
      desc="Define quando cada automação dispara dentro do ciclo do aluno."
      ultima={items.sort((a,b) => b.atualizado_em.localeCompare(a.atualizado_em))[0]}
      dirty={dirty}
    >
      <div className="grid grid-cols-2 gap-4">
        {numField("DIA_FOLLOWUP_1", "Follow-up 1 (dias)")}
        {numField("DIA_FEEDBACK_QUINZENAL", "Feedback quinzenal (dias)")}
        {numField("DIA_FOLLOWUP_2", "Follow-up 2 (dias)")}
        {numField("DIA_FEEDBACK_MENSAL", "Feedback mensal (dias)")}
        {numField("DELAY_RESPOSTA_HORAS", "Delay para resposta IA (horas)")}
        <div>
          <label className="text-xs font-medium text-muted-foreground">Horário diário do job</label>
          <input
            type="time"
            value={vals.JOB_HORARIO ?? "08:00"}
            onChange={(e) => setVals({ ...vals, JOB_HORARIO: e.target.value })}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="mt-5 rounded-lg border border-border bg-muted/30 p-4">
        <p className="text-xs font-medium text-muted-foreground mb-3">Linha do tempo do ciclo</p>
        <div className="flex items-center gap-2 overflow-x-auto text-xs">
          {[
            { l: "D0", v: "Início" },
            { l: `D+${vals.DIA_FOLLOWUP_1 || "?"}`, v: "Follow-up 1" },
            { l: `D+${vals.DIA_FEEDBACK_QUINZENAL || "?"}`, v: "Check-in Quinzenal" },
            { l: `D+${vals.DIA_FOLLOWUP_2 || "?"}`, v: "Follow-up 2" },
            { l: `D+${vals.DIA_FEEDBACK_MENSAL || "?"}`, v: "Feedback Mensal" },
          ].map((s, i, arr) => (
            <div key={i} className="flex items-center gap-2 shrink-0">
              <div className="rounded-md bg-card border border-border px-3 py-2 text-center min-w-[88px]">
                <div className="font-mono font-semibold text-foreground">{s.l}</div>
                <div className="text-muted-foreground text-[10px] mt-0.5">{s.v}</div>
              </div>
              {i < arr.length - 1 && <div className="text-muted-foreground">→</div>}
            </div>
          ))}
        </div>
      </div>

      <SaveBar disabled={!dirty || saving} saving={saving} onSave={handleSave} />
    </SectionCard>
  );
}

/* ======================= MENSAGENS FIXAS ======================= */
function MensagensFixasCard({ items, onSaved }: { items: ConfigItem[]; onSaved: () => void }) {
  const fetchVar = useServerFn(listMensagensVariantes);
  const [variantes, setVariantes] = useState<Record<string, { texto: string; ativo: boolean }[]>>({});
  const [loaded, setLoaded] = useState(false);

  const load = async () => {
    try {
      const r = await fetchVar();
      const map: Record<string, { texto: string; ativo: boolean }[]> = {};
      (r.variantes as any[]).forEach((v) => {
        (map[v.chave] ||= []).push({ texto: v.texto, ativo: v.ativo });
      });
      setVariantes(map);
    } finally { setLoaded(true); }
  };
  useEffect(() => { void load(); }, []);

  const fields: { chave: string; titulo: string; hint: string }[] = [
    { chave: "MSG_CONFIRMACAO_ANAMNESE", titulo: "Confirmação após receber anamnese", hint: "Use {nome}" },
    { chave: "MSG_FOLLOWUP_D7", titulo: "Follow-up 1", hint: "Use {nome} — primeiro follow-up do ciclo" },
    { chave: "MSG_LINK_QUINZENAL", titulo: "Feedback quinzenal", hint: "Use {nome} e {link}" },
    { chave: "MSG_CONFIRMACAO_QUINZENAL", titulo: "Confirmação após receber Feedback quinzenal", hint: "Use {nome}" },
    { chave: "MSG_FOLLOWUP_D21", titulo: "Follow-up 2", hint: "Use {nome} — segundo follow-up do ciclo" },
    { chave: "MSG_LINK_MENSAL", titulo: "Feedback mensal", hint: "Use {nome} e {link}" },
    { chave: "MSG_POS_FEEDBACK_MENSAL", titulo: "Confirmação após receber Feedback mensal", hint: "Use {nome}" },
  ];

  const itemMap = Object.fromEntries(items.map((i) => [i.chave, i.valor ?? ""]));

  return (
    <SectionCard
      icon={Send}
      title="Mensagens Fixas"
      desc="Adicione 3+ variações por tipo. O sistema sorteia uma aleatória a cada envio para reduzir detecção de automação pelo WhatsApp."
      ultima={items.sort((a,b) => b.atualizado_em.localeCompare(a.atualizado_em))[0]}
    >
      {!loaded ? (
        <div className="py-6 text-center text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline" /> Carregando variações…</div>
      ) : (
        <div className="space-y-6">
          {fields.map((f) => (
            <VariantesEditor
              key={f.chave}
              chave={f.chave}
              titulo={f.titulo}
              hint={f.hint}
              fallback={itemMap[f.chave] ?? ""}
              variantes={variantes[f.chave] ?? []}
              onSaved={() => { void load(); onSaved(); }}
            />
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function VariantesEditor({
  chave, titulo, hint, fallback, variantes, onSaved,
}: {
  chave: string;
  titulo: string;
  hint: string;
  fallback: string;
  variantes: { texto: string; ativo: boolean }[];
  onSaved: () => void;
}) {
  const save = useServerFn(saveMensagensVariantes);
  // Se nunca foi cadastrado, prefill com 1 variante a partir do fallback.
  const initial = useMemo(() => {
    if (variantes.length > 0) return variantes;
    if (fallback.trim().length > 0) return [{ texto: fallback, ativo: true }];
    return [{ texto: "", ativo: true }];
  }, [variantes, fallback]);
  const [lista, setLista] = useState<{ texto: string; ativo: boolean }[]>(initial);
  const [saving, setSaving] = useState(false);
  useEffect(() => setLista(initial), [initial]);
  const dirty = JSON.stringify(lista) !== JSON.stringify(initial);
  const ativas = lista.filter((v) => v.ativo && v.texto.trim().length > 0).length;

  const handleSave = async () => {
    setSaving(true);
    try {
      await save({ data: { chave, variantes: lista } });
      toast.success(`${titulo}: ${lista.filter((v) => v.texto.trim()).length} variação(ões) salva(s)`);
      onSaved();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao salvar"); }
    finally { setSaving(false); }
  };

  const previewRandom = () => {
    const ativos = lista.filter((v) => v.ativo && v.texto.trim().length > 0);
    if (!ativos.length) return toast.error("Nenhuma variação ativa para sortear");
    const escolhida = ativos[Math.floor(Math.random() * ativos.length)];
    toast.message("Variação sorteada", { description: escolhida.texto, duration: 8000 });
  };

  return (
    <div className="rounded-md border border-border bg-muted/10 p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <h3 className="text-sm font-medium text-foreground">{titulo}</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ${
            ativas >= 3 ? "bg-emerald-500/15 text-emerald-600" :
            ativas >= 1 ? "bg-amber-500/15 text-amber-600" :
            "bg-destructive/15 text-destructive"
          }`}>
            {ativas} ativa{ativas === 1 ? "" : "s"}{ativas < 3 ? " (recomendado 3+)" : ""}
          </span>
          <button
            type="button" onClick={previewRandom}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] hover:bg-muted"
          >
            <Shuffle className="h-3 w-3" /> Sortear
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {lista.map((v, i) => (
          <div key={i} className="rounded-md border border-border bg-background p-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-medium text-muted-foreground">Variação {i + 1}</span>
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <input
                    type="checkbox" checked={v.ativo}
                    onChange={(e) => {
                      const next = [...lista]; next[i] = { ...v, ativo: e.target.checked }; setLista(next);
                    }}
                  /> ativa
                </label>
                <button
                  type="button"
                  onClick={() => setLista(lista.filter((_, j) => j !== i))}
                  disabled={lista.length === 1}
                  className="text-muted-foreground hover:text-destructive disabled:opacity-30"
                  title="Remover variação"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <textarea
              value={v.texto}
              onChange={(e) => {
                const next = [...lista]; next[i] = { ...v, texto: e.target.value }; setLista(next);
              }}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              placeholder="Texto da variação…"
            />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mt-3">
        <button
          type="button"
          onClick={() => setLista([...lista, { texto: "", ativo: true }])}
          disabled={lista.length >= 20}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-50"
        >
          <Plus className="h-3 w-3" /> Adicionar variação
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty || saving}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          Salvar variações
        </button>
      </div>
    </div>
  );
}

/* ======================= PROMPTS IA ======================= */
function PromptsIACard({ prompts, onSaved }: { prompts: PromptItem[]; onSaved: () => void }) {
  const save = useServerFn(savePromptIA);
  const test = useServerFn(testarPromptIA);
  const initial = useMemo(() => Object.fromEntries(prompts.map((p) => [p.tipo, p.prompt_sistema])), [prompts]);
  const [vals, setVals] = useState<Record<string, string>>(initial);
  const [savingTipo, setSavingTipo] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [testModal, setTestModal] = useState<{ tipo: string; resposta: string } | null>(null);
  useEffect(() => setVals(initial), [initial]);
  const dirty = JSON.stringify(vals) !== JSON.stringify(initial);

  const handleSave = async (tipo: string) => {
    setSavingTipo(tipo);
    try {
      await save({ data: { tipo: tipo as any, prompt_sistema: vals[tipo] ?? "" } });
      toast.success("Prompt salvo");
      onSaved();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao salvar"); }
    finally { setSavingTipo(null); }
  };

  const testar = async (tipo: string) => {
    setTesting(tipo);
    try {
      const r = await test({ data: { prompt_sistema: vals[tipo] ?? "" } });
      if (r.ok) setTestModal({ tipo, resposta: r.resposta ?? "" });
      else toast.error(r.error || "Falha");
    } finally { setTesting(null); }
  };

  return (
    <SectionCard
      icon={Sparkles}
      title="Prompts da IA"
      desc="Comportamento da IA que gera as respostas dos feedbacks."
      ultima={prompts[0] ? { ...prompts[0], chave: "prompts", valor: "", tipo: "text", secao: "mensagens", atualizado_por_nome: null } as any : undefined}
      dirty={dirty}
    >
      <div className="space-y-5">
        {(["feedback_quinzenal","feedback_mensal"] as const).map((tipo) => {
          const meta = PROMPT_LABELS[tipo];
          const v = vals[tipo] ?? "";
          return (
            <div key={tipo}>
              <div className="flex items-baseline justify-between">
                <label className="text-sm font-medium text-foreground">{meta.titulo}</label>
                <span className="text-[11px] text-muted-foreground">{v.length} caracteres</span>
              </div>
              <p className="text-xs text-muted-foreground mb-1.5">{meta.desc}</p>
              <textarea
                value={v}
                onChange={(e) => setVals({ ...vals, [tipo]: e.target.value })}
                placeholder={meta.placeholder}
                rows={6}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
              />
              <div className="mt-2 flex items-center gap-2">
                <button onClick={() => testar(tipo)} disabled={!v || testing === tipo}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-50">
                  {testing === tipo ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                  Testar prompt
                </button>
                <button onClick={() => handleSave(tipo)} disabled={v === (initial[tipo] ?? "") || savingTipo === tipo}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50">
                  {savingTipo === tipo ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                  Salvar
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {testModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 px-safe" onClick={() => setTestModal(null)}>
          <div className="w-full max-w-2xl rounded-xl border border-border bg-card p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Prévia — {PROMPT_LABELS[testModal.tipo].titulo}</h3>
              <button onClick={() => setTestModal(null)}><X className="h-4 w-4" /></button>
            </div>
            <div className="rounded-md border border-border bg-muted/20 p-4 text-sm whitespace-pre-wrap max-h-[60vh] overflow-y-auto">
              {testModal.resposta || <span className="text-muted-foreground">(resposta vazia)</span>}
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

/* ======================= HISTÓRICO ======================= */
function HistoricoCard() {
  const fetchResumo = useServerFn(getResumoDisparos);
  const fetchHist = useServerFn(getHistoricoDisparos);
  const reenviar = useServerFn(reenviarJob);
  const [resumo, setResumo] = useState<{ enviadosHoje: number; errosPendentes: number; proximo: any } | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [tipo, setTipo] = useState("todos");
  const [status, setStatus] = useState<"todos"|"enviado"|"erro"|"pendente">("todos");
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [r, h] = await Promise.all([fetchResumo(), fetchHist({ data: { tipo, status, busca, page } })]);
      setResumo(r); setRows(h.rows); setTotal(h.total);
    } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [tipo, status, page]);

  const handleReenviar = async (id: string) => {
    try { await reenviar({ data: { jobId: id } }); toast.success("Job reagendado"); void load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Falha"); }
  };

  return (
    <SectionCard icon={History} title="Histórico de Disparos" desc="Todos os envios automáticos do motor.">
      <div className="grid grid-cols-3 gap-3 mb-4">
        <ResumoCard label="Enviados hoje" value={resumo?.enviadosHoje ?? 0} icon={CheckCircle2} color="emerald" />
        <ResumoCard label="Erros pendentes" value={resumo?.errosPendentes ?? 0} icon={AlertCircle} color="destructive" />
        <ResumoCard label="Próximo agendado" value={resumo?.proximo ? new Date(resumo.proximo.agendado_para).toLocaleString("pt-BR") : "—"} icon={Clock} color="primary" small />
      </div>

      <div className="flex gap-2 flex-wrap mb-3">
        <select value={tipo} onChange={(e) => { setTipo(e.target.value); setPage(1); }}
          className="rounded-md border border-input bg-background px-2 py-1.5 text-xs">
          <option value="todos">Todos os tipos</option>
          <option value="followup_d7">Follow-up D+7</option>
          <option value="followup_d21">Follow-up D+21</option>
          <option value="feedback_quinzenal">Feedback Quinzenal</option>
          <option value="feedback_mensal">Feedback Mensal</option>
          <option value="anamnese">Anamnese</option>
        </select>
        <select value={status} onChange={(e) => { setStatus(e.target.value as any); setPage(1); }}
          className="rounded-md border border-input bg-background px-2 py-1.5 text-xs">
          <option value="todos">Todos os status</option>
          <option value="enviado">Enviados</option>
          <option value="erro">Com erro</option>
          <option value="pendente">Pendentes</option>
        </select>
        <input
          value={busca} onChange={(e) => setBusca(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (setPage(1), load())}
          placeholder="Buscar por aluno…"
          className="flex-1 min-w-[180px] rounded-md border border-input bg-background px-3 py-1.5 text-xs"
        />
        <button onClick={() => { setPage(1); void load(); }}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:bg-muted inline-flex items-center gap-1">
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </button>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-muted/30 text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Tipo</th>
              <th className="text-left font-medium">Aluno</th>
              <th className="text-left font-medium">Agendado</th>
              <th className="text-left font-medium">Status</th>
              <th className="pr-3 font-medium text-right">Ação</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Nenhum disparo encontrado</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="border-t border-border/40">
                <td className="px-3 py-2 font-mono">{r.tipo}</td>
                <td>{r.aluno_nome}</td>
                <td className="text-muted-foreground">{new Date(r.agendado_para).toLocaleString("pt-BR")}</td>
                <td>
                  {r.executado ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-600">Enviado</span>
                  ) : r.erro ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] text-destructive" title={r.erro}>Erro</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">Pendente</span>
                  )}
                </td>
                <td className="pr-3 text-right">
                  {r.erro && (
                    <button onClick={() => handleReenviar(r.id)}
                      className="rounded-md border border-border bg-background px-2 py-1 text-[10px] hover:bg-muted">
                      Reenviar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {total > 20 && (
        <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
          <span>{total} registros</span>
          <div className="flex gap-1">
            <button disabled={page === 1} onClick={() => setPage(page - 1)}
              className="rounded border border-border bg-background px-2 py-1 disabled:opacity-40">Anterior</button>
            <span className="px-2 py-1">Página {page}</span>
            <button disabled={page * 20 >= total} onClick={() => setPage(page + 1)}
              className="rounded border border-border bg-background px-2 py-1 disabled:opacity-40">Próxima</button>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

/* ======================= UI HELPERS ======================= */
function SectionCard({ icon: Icon, title, desc, ultima, dirty, children }: {
  icon: any; title: string; desc: string; ultima?: ConfigItem; dirty?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Icon className="h-4 w-4 text-primary mt-0.5" />
          <div>
            <h2 className="font-semibold flex items-center gap-2">
              {title}
              {dirty && <span className="h-2 w-2 rounded-full bg-amber-500" title="Alterações não salvas" />}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
          </div>
        </div>
      </div>
      <div className="p-5">{children}</div>
      {ultima && (
        <div className="px-5 py-2 border-t border-border bg-muted/20 text-[11px] text-muted-foreground">
          Última edição: {ultima.atualizado_por_nome ?? "—"} — {new Date(ultima.atualizado_em).toLocaleString("pt-BR")}
        </div>
      )}
    </div>
  );
}

function SaveBar({ disabled, saving, onSave }: { disabled: boolean; saving: boolean; onSave: () => void }) {
  return (
    <div className="mt-5 flex justify-end">
      <button onClick={onSave} disabled={disabled}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Salvar
      </button>
    </div>
  );
}

function ResumoCard({ label, value, icon: Icon, color, small }: {
  label: string; value: number | string; icon: any; color: "emerald"|"destructive"|"primary"; small?: boolean;
}) {
  const colorMap = {
    emerald: "text-emerald-600 bg-emerald-500/10",
    destructive: "text-destructive bg-destructive/10",
    primary: "text-primary bg-primary/10",
  } as const;
  return (
    <div className="rounded-lg border border-border bg-card p-3 flex items-center gap-3">
      <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${colorMap[color]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] text-muted-foreground">{label}</div>
        <div className={`font-semibold ${small ? "text-xs" : "text-lg"} truncate`}>{value}</div>
      </div>
    </div>
  );
}