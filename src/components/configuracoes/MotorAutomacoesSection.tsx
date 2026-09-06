import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  getWorkflowConfig, saveWorkflowConfig,
  getPromptsIA, savePromptIA, testarPromptIA,
  getHistoricoDisparos, reenviarJob,
} from "@/server/workflow.functions";
import { listMensagensVariantes, saveMensagensVariantes } from "@/server/mensagens-variantes.functions";
import { getMotorStatus, testarEnvioMensagem } from "@/server/motor-status.functions";
import {
  Power, Clock, Send, Sparkles, History, Bell, RefreshCcw,
  Loader2, Save, RefreshCw, Play, X, Plus, Trash2, Shuffle, Copy, Eye, AlertCircle,
} from "lucide-react";

/* ============================ TIPOS ============================ */
type ConfigItem = {
  chave: string; valor: string | null; tipo: string; secao: string;
  atualizado_em: string; atualizado_por_nome: string | null;
};
type PromptItem = { tipo: string; prompt_sistema: string; atualizado_em: string };
type Variante = { texto: string; ativo: boolean };

export const VARIAVEIS = [
  "{nome}", "{primeiro_nome}", "{profissional}", "{data_entrega}", "{link_feedback}",
  "{plano}", "{data_vencimento}", "{dias_para_vencer}", "{link_renovacao}", "{link}",
];

const UNIDADES = ["minutos", "horas", "dias"] as const;

const MENSAGENS: { chave: string; titulo: string; hint: string }[] = [
  { chave: "MSG_CONFIRMACAO_ANAMNESE", titulo: "Confirmação de recebimento da anamnese", hint: "Enviada assim que o aluno envia a anamnese." },
  { chave: "MSG_CONFIRMACAO_ENTREGA", titulo: "Confirmação da entrega do planejamento", hint: "Enviada quando o profissional marca o planejamento como entregue." },
  { chave: "MSG_FOLLOWUP_D7", titulo: "Follow-up D+7", hint: "Primeiro acompanhamento após a entrega." },
  { chave: "MSG_LINK_QUINZENAL", titulo: "Envio do feedback quinzenal", hint: "Use {link_feedback}." },
  { chave: "MSG_LEMBRETE_QUINZENAL", titulo: "Lembrete do feedback quinzenal", hint: "Enviado se o aluno não responder." },
  { chave: "MSG_FOLLOWUP_D21", titulo: "Follow-up D+21", hint: "Segundo acompanhamento do ciclo." },
  { chave: "MSG_LINK_MENSAL", titulo: "Envio do feedback mensal", hint: "Use {link_feedback}." },
  { chave: "MSG_LEMBRETE_MENSAL", titulo: "Lembrete do feedback mensal", hint: "Enviado se o aluno não responder." },
  { chave: "MSG_RENOVACAO_ANTES", titulo: "Renovação antes do vencimento", hint: "Use {dias_para_vencer} e {link_renovacao}." },
  { chave: "MSG_RENOVACAO_DIA", titulo: "Renovação no dia do vencimento", hint: "Use {plano} e {link_renovacao}." },
  { chave: "MSG_RENOVACAO_APOS", titulo: "Renovação após o vencimento", hint: "Use {data_vencimento} e {link_renovacao}." },
];

const IA_BLOCOS = [
  { prefixo: "IA_ANAMNESE", titulo: "Resposta após a anamnese", tipoPrompt: "anamnese" },
  { prefixo: "IA_QUINZENAL", titulo: "Resposta após o feedback quinzenal", tipoPrompt: "feedback_quinzenal" },
  { prefixo: "IA_MENSAL", titulo: "Resposta após o feedback mensal", tipoPrompt: "feedback_mensal" },
] as const;

const DIAS = [
  { v: "1", l: "Seg" }, { v: "2", l: "Ter" }, { v: "3", l: "Qua" },
  { v: "4", l: "Qui" }, { v: "5", l: "Sex" }, { v: "6", l: "Sáb" }, { v: "0", l: "Dom" },
];

function variaveisInvalidas(texto: string) {
  const usadas = texto.match(/\{[a-z_]+\}/gi) ?? [];
  return Array.from(new Set(usadas.filter((v) => !VARIAVEIS.includes(v.toLowerCase()))));
}

/* ============================ PÁGINA ============================ */
export function MotorAutomacoesSection() {
  const fetchConfig = useServerFn(getWorkflowConfig);
  const fetchPrompts = useServerFn(getPromptsIA);
  const fetchStatus = useServerFn(getMotorStatus);

  const [itens, setItens] = useState<ConfigItem[]>([]);
  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [c, p, s] = await Promise.all([fetchConfig(), fetchPrompts(), fetchStatus()]);
      setItens(c.itens as ConfigItem[]);
      setPrompts(p.prompts as PromptItem[]);
      setStatus(s);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao carregar");
    } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const sec = (s: string) => itens.filter((i) => i.secao === s);
  const item = (c: string) => itens.find((i) => i.chave === c);

  if (loading) {
    return <div className="flex items-center justify-center py-16 text-sm text-muted-foreground gap-2">
      <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
    </div>;
  }

  return (
    <div className="space-y-6">
      <ControleGeral motor={item("MOTOR_ATIVO")} status={status} onSaved={load} />
      <CicloCard items={sec("ciclo")} onSaved={load} />
      <MensagensFixasCard onSaved={load} />
      <RespostasIACard config={sec("ia")} prompts={prompts} onSaved={load} />
      <LembretesCard items={sec("lembretes")} onSaved={load} />
      <RenovacaoCard item={item("RENOVACAO_ETAPAS")} onSaved={load} />
      <HistoricoCard />
    </div>
  );
}

/* ============================ 1. CONTROLE GERAL ============================ */
function ControleGeral({ motor, status, onSaved }: { motor?: ConfigItem; status: any; onSaved: () => void }) {
  const save = useServerFn(saveWorkflowConfig);
  const ativo = motor?.valor === "true";
  const comErro = (status?.errosPendentes ?? 0) > 0;
  const [saving, setSaving] = useState(false);

  const toggle = async () => {
    setSaving(true);
    try {
      await save({ data: { secao: "motor", valores: { MOTOR_ATIVO: ativo ? "false" : "true" } } });
      toast.success(ativo ? "Motor pausado — nenhum novo envio será feito" : "Motor ativado");
      onSaved();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao salvar"); }
    finally { setSaving(false); }
  };

  const fmt = (d: string | null) => (d ? new Date(d).toLocaleString("pt-BR") : "—");

  return (
    <SectionCard icon={Power} title="Controle geral" desc="Liga, pausa e monitora todo o motor de automações." ultima={motor}>
      <div className="flex flex-wrap items-center gap-4">
        <button onClick={toggle} disabled={saving}
          className={`relative inline-flex h-9 w-16 items-center rounded-full transition-colors disabled:opacity-50 ${ativo ? "bg-emerald-500" : "bg-muted"}`}>
          <span className={`inline-block h-7 w-7 rounded-full bg-white shadow transition-transform ${ativo ? "translate-x-8" : "translate-x-1"}`} />
        </button>
        {!ativo ? (
          <Badge tone="destructive"><X className="h-3 w-3" /> Pausado</Badge>
        ) : comErro ? (
          <Badge tone="amber"><AlertCircle className="h-3 w-3" /> Com erro</Badge>
        ) : (
          <Badge tone="emerald"><span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Ativo</Badge>
        )}
        <span className="text-xs text-muted-foreground">
          Ao pausar, as mensagens programadas ficam aguardando a reativação.
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Alunos com automações ativas" value={status?.alunosAtivos ?? 0} />
        <Metric label="Mensagens programadas" value={status?.mensagensProgramadas ?? 0} />
        <Metric label="Próximo disparo" value={fmt(status?.proximoDisparo ?? null)} small />
        <Metric label="Última execução" value={fmt(status?.ultimaExecucao ?? null)} small />
      </div>
    </SectionCard>
  );
}

/* ============================ 2 + 3. CICLO ============================ */
function CicloCard({ items, onSaved }: { items: ConfigItem[]; onSaved: () => void }) {
  const save = useServerFn(saveWorkflowConfig);
  const initial = useMemo(() => Object.fromEntries(items.map((i) => [i.chave, i.valor ?? ""])), [items]);
  const [vals, setVals] = useState<Record<string, string>>(initial);
  const [saving, setSaving] = useState(false);
  useEffect(() => setVals(initial), [initial]);
  const dirty = JSON.stringify(vals) !== JSON.stringify(initial);

  const set = (k: string, v: string) => setVals((p) => ({ ...p, [k]: v }));
  const dias = (vals.DIAS_SEMANA ?? "").split(",").filter(Boolean);
  const toggleDia = (d: string) =>
    set("DIAS_SEMANA", (dias.includes(d) ? dias.filter((x) => x !== d) : [...dias, d]).sort().join(","));

  const handleSave = async () => {
    setSaving(true);
    try {
      await save({ data: { secao: "ciclo", valores: vals } });
      toast.success("Ciclo de acompanhamento salvo");
      onSaved();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao salvar"); }
    finally { setSaving(false); }
  };

  const etapa = (chaveVal: string, chaveUn: string, label: string) => (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="mt-1 flex gap-2">
        <input type="number" min={0} max={999} value={vals[chaveVal] ?? ""}
          onChange={(e) => set(chaveVal, e.target.value)}
          className="w-24 rounded-md border border-input bg-background px-3 py-2 text-sm" />
        <select value={vals[chaveUn] ?? "dias"} onChange={(e) => set(chaveUn, e.target.value)}
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm">
          {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
      </div>
    </div>
  );

  const rotulo = (v?: string, u?: string) => `${v || "?"} ${(u || "dias").slice(0, 1) === "m" ? "min" : (u || "dias").slice(0, 1) === "h" ? "h" : "d"}`;

  const timeline = [
    { t: "Anamnese", s: "Início" },
    { t: "Planejamento", s: "Entrega (D0)" },
    { t: "Follow-up 1", s: rotulo(vals.DIA_FOLLOWUP_1, vals.UNIDADE_FOLLOWUP_1) },
    { t: "Feedback quinzenal", s: rotulo(vals.DIA_FEEDBACK_QUINZENAL, vals.UNIDADE_FEEDBACK_QUINZENAL) },
    { t: "Follow-up 2", s: rotulo(vals.DIA_FOLLOWUP_2, vals.UNIDADE_FOLLOWUP_2) },
    { t: "Feedback mensal", s: rotulo(vals.DIA_FEEDBACK_MENSAL, vals.UNIDADE_FEEDBACK_MENSAL) },
    { t: "Renovação", s: "Vencimento" },
  ];

  return (
    <SectionCard icon={Clock} title="Ciclo de acompanhamento"
      desc="Prazos de cada etapa a partir da entrega do planejamento. A linha do tempo atualiza na hora."
      ultima={[...items].sort((a, b) => b.atualizado_em.localeCompare(a.atualizado_em))[0]} dirty={dirty}>

      <div className="rounded-lg border border-border bg-muted/30 p-4 mb-5">
        <p className="text-xs font-medium text-muted-foreground mb-3">Linha do tempo</p>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          {timeline.map((s, i) => (
            <div key={i} className="flex items-center gap-2 shrink-0">
              <div className="rounded-md bg-card border border-border px-3 py-2 text-center min-w-[110px]">
                <div className="font-semibold text-foreground">{s.t}</div>
                <div className="text-muted-foreground text-[10px] mt-0.5 font-mono">{s.s}</div>
              </div>
              {i < timeline.length - 1 && <span className="text-muted-foreground">→</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {etapa("DIA_FOLLOWUP_1", "UNIDADE_FOLLOWUP_1", "Follow-up D+7 (após a entrega)")}
        {etapa("DIA_FEEDBACK_QUINZENAL", "UNIDADE_FEEDBACK_QUINZENAL", "Feedback quinzenal (após a entrega)")}
        {etapa("DIA_FOLLOWUP_2", "UNIDADE_FOLLOWUP_2", "Follow-up D+21 (após a entrega)")}
        {etapa("DIA_FEEDBACK_MENSAL", "UNIDADE_FEEDBACK_MENSAL", "Feedback mensal (após a entrega)")}
        <div>
          <label className="text-xs font-medium text-muted-foreground">Horário padrão dos disparos</label>
          <input type="time" value={vals.JOB_HORARIO ?? "08:00"} onChange={(e) => set("JOB_HORARIO", e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Fuso horário</label>
          <select value={vals.FUSO_HORARIO ?? "America/Recife"} onChange={(e) => set("FUSO_HORARIO", e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            {["America/Recife", "America/Sao_Paulo", "America/Manaus", "America/Belem", "America/Fortaleza"].map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4">
        <label className="text-xs font-medium text-muted-foreground">Dias da semana permitidos</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {DIAS.map((d) => (
            <button key={d.v} type="button" onClick={() => toggleDia(d.v)}
              className={`rounded-md border px-3 py-1.5 text-xs ${dias.includes(d.v)
                ? "border-primary bg-primary/10 text-primary font-medium"
                : "border-border bg-background text-muted-foreground"}`}>
              {d.l}
            </button>
          ))}
        </div>
      </div>

      <SaveBar disabled={!dirty || saving} saving={saving} onSave={handleSave} />
    </SectionCard>
  );
}

/* ============================ 4. MENSAGENS FIXAS ============================ */
function MensagensFixasCard({ onSaved }: { onSaved: () => void }) {
  const fetchVar = useServerFn(listMensagensVariantes);
  const [map, setMap] = useState<Record<string, Variante[]>>({});
  const [loaded, setLoaded] = useState(false);

  const load = async () => {
    try {
      const r = await fetchVar();
      const m: Record<string, Variante[]> = {};
      (r.variantes as any[]).forEach((v) => { (m[v.chave] ||= []).push({ texto: v.texto, ativo: v.ativo }); });
      setMap(m);
    } finally { setLoaded(true); }
  };
  useEffect(() => { void load(); }, []);

  return (
    <SectionCard icon={Send} title="Mensagens fixas"
      desc="Textos escritos manualmente. A IA nunca reescreve estas mensagens. O sistema sorteia uma variação ativa a cada envio.">
      <div className="mb-4 flex flex-wrap gap-1.5">
        {VARIAVEIS.map((v) => (
          <code key={v} className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">{v}</code>
        ))}
      </div>
      {!loaded ? (
        <div className="py-6 text-center text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline" /> Carregando…</div>
      ) : (
        <div className="space-y-4">
          {MENSAGENS.map((m) => (
            <VariantesEditor key={m.chave} chave={m.chave} titulo={m.titulo} hint={m.hint}
              variantes={map[m.chave] ?? []} onSaved={() => { void load(); onSaved(); }} />
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function VariantesEditor({ chave, titulo, hint, variantes, onSaved }: {
  chave: string; titulo: string; hint: string; variantes: Variante[]; onSaved: () => void;
}) {
  const save = useServerFn(saveMensagensVariantes);
  const enviarTeste = useServerFn(testarEnvioMensagem);
  const initial = useMemo(() => (variantes.length ? variantes : [{ texto: "", ativo: true }]), [variantes]);
  const [lista, setLista] = useState<Variante[]>(initial);
  const [saving, setSaving] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [testeFone, setTesteFone] = useState("");
  const [enviando, setEnviando] = useState(false);
  useEffect(() => setLista(initial), [initial]);

  const dirty = JSON.stringify(lista) !== JSON.stringify(initial);
  const ativas = lista.filter((v) => v.ativo && v.texto.trim()).length;
  const upd = (i: number, patch: Partial<Variante>) =>
    setLista((l) => l.map((v, j) => (j === i ? { ...v, ...patch } : v)));

  const handleSave = async () => {
    const invalidas = Array.from(new Set(lista.flatMap((v) => variaveisInvalidas(v.texto))));
    if (invalidas.length) return toast.error(`Variável sem origem válida: ${invalidas.join(", ")}`);
    setSaving(true);
    try {
      await save({ data: { chave, variantes: lista } });
      toast.success("Mensagem salva");
      onSaved();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao salvar"); }
    finally { setSaving(false); }
  };

  const sortear = () => {
    const ok = lista.filter((v) => v.ativo && v.texto.trim());
    if (!ok.length) return toast.error("Nenhuma variação ativa");
    setPreview(ok[Math.floor(Math.random() * ok.length)].texto);
  };

  const testar = async () => {
    const ok = lista.filter((v) => v.ativo && v.texto.trim());
    if (!ok.length) return toast.error("Nenhuma variação ativa");
    setEnviando(true);
    try {
      const r = await enviarTeste({ data: { telefone: testeFone, mensagem: ok[0].texto } });
      if (r.ok) toast.success("Envio de teste realizado");
      else toast.error(r.error ?? "Falha no envio de teste");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha no envio"); }
    finally { setEnviando(false); }
  };

  return (
    <div className="rounded-md border border-border bg-muted/10">
      <button type="button" onClick={() => setAberto(!aberto)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
        <div>
          <h3 className="text-sm font-medium">{titulo}</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${ativas ? "bg-emerald-500/15 text-emerald-600" : "bg-destructive/15 text-destructive"}`}>
          {ativas} ativa{ativas === 1 ? "" : "s"}
        </span>
      </button>

      {aberto && (
        <div className="border-t border-border px-4 py-3 space-y-2">
          {lista.map((v, i) => (
            <div key={i} className="rounded-md border border-border bg-background p-2">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[11px] font-medium text-muted-foreground">Variação {i + 1}</span>
                <div className="flex items-center gap-2">
                  <label className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <input type="checkbox" checked={v.ativo} onChange={(e) => upd(i, { ativo: e.target.checked })} /> ativa
                  </label>
                  <button type="button" title="Duplicar" onClick={() => setLista([...lista, { ...v }])}
                    className="text-muted-foreground hover:text-foreground"><Copy className="h-3.5 w-3.5" /></button>
                  <button type="button" title="Prévia" onClick={() => setPreview(v.texto)}
                    className="text-muted-foreground hover:text-foreground"><Eye className="h-3.5 w-3.5" /></button>
                  <button type="button" title="Excluir" disabled={lista.length === 1}
                    onClick={() => setLista(lista.filter((_, j) => j !== i))}
                    className="text-muted-foreground hover:text-destructive disabled:opacity-30"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
              <textarea value={v.texto} rows={3} onChange={(e) => upd(i, { texto: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                placeholder="Texto da mensagem…" />
            </div>
          ))}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button type="button" onClick={() => setLista([...lista, { texto: "", ativo: true }])}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:bg-muted">
              <Plus className="h-3 w-3" /> Adicionar variação
            </button>
            <button type="button" onClick={sortear}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:bg-muted">
              <Shuffle className="h-3 w-3" /> Sortear prévia
            </button>
            <input value={testeFone} onChange={(e) => setTesteFone(e.target.value)} placeholder="WhatsApp para teste"
              className="w-44 rounded-md border border-input bg-background px-2 py-1.5 text-xs" />
            <button type="button" onClick={testar} disabled={enviando || testeFone.replace(/\D/g, "").length < 10}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-50">
              {enviando ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />} Testar envio
            </button>
            <button type="button" onClick={handleSave} disabled={!dirty || saving}
              className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50">
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Salvar
            </button>
          </div>
        </div>
      )}

      {preview !== null && <Modal titulo={`Prévia — ${titulo}`} onClose={() => setPreview(null)}>{preview}</Modal>}
    </div>
  );
}

/* ============================ 5/7/8/9. RESPOSTAS DA IA ============================ */
function RespostasIACard({ config, prompts, onSaved }: { config: ConfigItem[]; prompts: PromptItem[]; onSaved: () => void }) {
  const save = useServerFn(saveWorkflowConfig);
  const savePrompt = useServerFn(savePromptIA);
  const testar = useServerFn(testarPromptIA);

  const initialCfg = useMemo(() => Object.fromEntries(config.map((i) => [i.chave, i.valor ?? ""])), [config]);
  const initialPrompts = useMemo(
    () => Object.fromEntries(IA_BLOCOS.map((b) => [b.tipoPrompt, prompts.find((p) => p.tipo === b.tipoPrompt)?.prompt_sistema ?? ""])),
    [prompts],
  );
  const [cfg, setCfg] = useState<Record<string, string>>(initialCfg);
  const [txt, setTxt] = useState<Record<string, string>>(initialPrompts);
  const [anterior, setAnterior] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [testando, setTestando] = useState<string | null>(null);
  const [modal, setModal] = useState<{ titulo: string; corpo: string } | null>(null);
  useEffect(() => setCfg(initialCfg), [initialCfg]);
  useEffect(() => setTxt(initialPrompts), [initialPrompts]);

  const dirty = JSON.stringify(cfg) !== JSON.stringify(initialCfg) || JSON.stringify(txt) !== JSON.stringify(initialPrompts);
  const set = (k: string, v: string) => setCfg((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await save({ data: { secao: "ia", valores: cfg } });
      for (const b of IA_BLOCOS) {
        if (txt[b.tipoPrompt] !== initialPrompts[b.tipoPrompt]) {
          setAnterior((a) => ({ ...a, [b.tipoPrompt]: initialPrompts[b.tipoPrompt] }));
          await savePrompt({ data: { tipo: b.tipoPrompt as any, prompt_sistema: txt[b.tipoPrompt] } });
        }
      }
      toast.success("Respostas da IA salvas");
      onSaved();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao salvar"); }
    finally { setSaving(false); }
  };

  const testarPrompt = async (tipo: string, titulo: string) => {
    setTestando(tipo);
    try {
      const r: any = await testar({ data: { prompt_sistema: txt[tipo] } });
      if (r.ok) setModal({ titulo: `Prévia — ${titulo}`, corpo: r.resposta ?? "" });
      else toast.error(r.error ?? "Falha ao testar");
    } finally { setTestando(null); }
  };

  return (
    <SectionCard icon={Sparkles} title="Respostas da IA"
      desc="A IA só entra em ação depois que o aluno preenche a anamnese ou um dos feedbacks. Ela nunca escreve follow-ups, lembretes ou mensagens de renovação."
      dirty={dirty}>
      <div className="space-y-5">
        {IA_BLOCOS.map((b) => (
          <div key={b.prefixo} className="rounded-md border border-border bg-muted/10 p-4">
            <h3 className="text-sm font-medium mb-3">{b.titulo}</h3>

            <div className="grid gap-3 sm:grid-cols-4">
              <div>
                <label className="text-xs text-muted-foreground">Tempo de resposta</label>
                <input type="number" min={0} value={cfg[`${b.prefixo}_VALOR`] ?? ""}
                  onChange={(e) => set(`${b.prefixo}_VALOR`, e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Unidade</label>
                <select value={cfg[`${b.prefixo}_UNIDADE`] ?? "horas"} onChange={(e) => set(`${b.prefixo}_UNIDADE`, e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="minutos">minutos</option>
                  <option value="horas">horas</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Modo de envio</label>
                <select value={cfg[`${b.prefixo}_MODO`] ?? "automatico"} onChange={(e) => set(`${b.prefixo}_MODO`, e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="automatico">Envio automático</option>
                  <option value="manual">Revisão manual</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">Das</label>
                  <input type="time" value={cfg[`${b.prefixo}_JANELA_INICIO`] ?? "08:00"}
                    onChange={(e) => set(`${b.prefixo}_JANELA_INICIO`, e.target.value)}
                    className="mt-1 w-full rounded-md border border-input bg-background px-2 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Até</label>
                  <input type="time" value={cfg[`${b.prefixo}_JANELA_FIM`] ?? "20:00"}
                    onChange={(e) => set(`${b.prefixo}_JANELA_FIM`, e.target.value)}
                    className="mt-1 w-full rounded-md border border-input bg-background px-2 py-2 text-sm" />
                </div>
              </div>
            </div>

            <div className="mt-3">
              <div className="flex items-center justify-between">
                <label className="text-xs text-muted-foreground">Prompt</label>
                <span className="text-[11px] text-muted-foreground">{(txt[b.tipoPrompt] ?? "").length} caracteres</span>
              </div>
              <textarea rows={5} value={txt[b.tipoPrompt] ?? ""}
                onChange={(e) => setTxt((p) => ({ ...p, [b.tipoPrompt]: e.target.value }))}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" onClick={() => testarPrompt(b.tipoPrompt, b.titulo)}
                  disabled={!txt[b.tipoPrompt] || testando === b.tipoPrompt}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-50">
                  {testando === b.tipoPrompt ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />} Testar e visualizar
                </button>
                {anterior[b.tipoPrompt] !== undefined && (
                  <button type="button" onClick={() => setTxt((p) => ({ ...p, [b.tipoPrompt]: anterior[b.tipoPrompt] }))}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:bg-muted">
                    <RefreshCcw className="h-3 w-3" /> Restaurar versão anterior
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      <SaveBar disabled={!dirty || saving} saving={saving} onSave={handleSave} />
      {modal && <Modal titulo={modal.titulo} onClose={() => setModal(null)}>{modal.corpo}</Modal>}
    </SectionCard>
  );
}

/* ============================ 10. LEMBRETES ============================ */
function LembretesCard({ items, onSaved }: { items: ConfigItem[]; onSaved: () => void }) {
  const save = useServerFn(saveWorkflowConfig);
  const initial = useMemo(() => Object.fromEntries(items.map((i) => [i.chave, i.valor ?? ""])), [items]);
  const [vals, setVals] = useState<Record<string, string>>(initial);
  const [saving, setSaving] = useState(false);
  useEffect(() => setVals(initial), [initial]);
  const dirty = JSON.stringify(vals) !== JSON.stringify(initial);
  const set = (k: string, v: string) => setVals((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await save({ data: { secao: "lembretes", valores: vals } });
      toast.success("Lembretes salvos");
      onSaved();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao salvar"); }
    finally { setSaving(false); }
  };

  const bloco = (prefixo: string, titulo: string) => (
    <div className="rounded-md border border-border bg-muted/10 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium">{titulo}</h3>
        <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={vals[`${prefixo}_ATIVO`] === "true"}
            onChange={(e) => set(`${prefixo}_ATIVO`, e.target.checked ? "true" : "false")} /> ativo
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="text-xs text-muted-foreground">Enviar após</label>
          <input type="number" min={1} value={vals[`${prefixo}_VALOR`] ?? ""}
            onChange={(e) => set(`${prefixo}_VALOR`, e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Unidade</label>
          <select value={vals[`${prefixo}_UNIDADE`] ?? "horas"} onChange={(e) => set(`${prefixo}_UNIDADE`, e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Máximo de lembretes</label>
          <input type="number" min={0} max={10} value={vals[`${prefixo}_MAX`] ?? ""}
            onChange={(e) => set(`${prefixo}_MAX`, e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </div>
      </div>
    </div>
  );

  return (
    <SectionCard icon={Bell} title="Lembretes de formulário pendente"
      desc="Os lembretes são cancelados automaticamente assim que o aluno responde o formulário."
      ultima={[...items].sort((a, b) => b.atualizado_em.localeCompare(a.atualizado_em))[0]} dirty={dirty}>
      <div className="space-y-4">
        {bloco("LEMBRETE_QUINZENAL", "Feedback quinzenal")}
        {bloco("LEMBRETE_MENSAL", "Feedback mensal")}
      </div>
      <SaveBar disabled={!dirty || saving} saving={saving} onSave={handleSave} />
    </SectionCard>
  );
}

/* ============================ 11. RENOVAÇÃO ============================ */
type EtapaRenov = { dias: number; quando: "antes" | "dia" | "apos" };

function RenovacaoCard({ item, onSaved }: { item?: ConfigItem; onSaved: () => void }) {
  const save = useServerFn(saveWorkflowConfig);
  const initial = useMemo<EtapaRenov[]>(() => {
    try { return JSON.parse(item?.valor ?? "[]"); } catch { return []; }
  }, [item]);
  const [etapas, setEtapas] = useState<EtapaRenov[]>(initial);
  const [saving, setSaving] = useState(false);
  useEffect(() => setEtapas(initial), [initial]);
  const dirty = JSON.stringify(etapas) !== JSON.stringify(initial);

  const handleSave = async () => {
    setSaving(true);
    try {
      await save({ data: { secao: "renovacao", valores: { RENOVACAO_ETAPAS: JSON.stringify(etapas) } } });
      toast.success("Etapas de renovação salvas");
      onSaved();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao salvar"); }
    finally { setSaving(false); }
  };

  return (
    <SectionCard icon={RefreshCcw} title="Renovação"
      desc="Etapas calculadas a partir da data de vencimento do plano. O fluxo é encerrado no pagamento confirmado, na atualização do vencimento, na renovação manual ou quando o aluno é marcado como inativo."
      ultima={item} dirty={dirty}>
      <div className="space-y-2">
        {etapas.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma etapa cadastrada.</p>}
        {etapas.map((e, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-background p-2">
            <input type="number" min={0} value={e.dias}
              onChange={(ev) => setEtapas(etapas.map((x, j) => (j === i ? { ...x, dias: Number(ev.target.value) } : x)))}
              disabled={e.quando === "dia"}
              className="w-20 rounded-md border border-input bg-background px-2 py-1.5 text-sm disabled:opacity-50" />
            <span className="text-xs text-muted-foreground">dias</span>
            <select value={e.quando}
              onChange={(ev) => setEtapas(etapas.map((x, j) => (j === i ? { ...x, quando: ev.target.value as EtapaRenov["quando"] } : x)))}
              className="rounded-md border border-input bg-background px-2 py-1.5 text-sm">
              <option value="antes">antes do vencimento</option>
              <option value="dia">no dia do vencimento</option>
              <option value="apos">após o vencimento</option>
            </select>
            <button type="button" onClick={() => setEtapas(etapas.filter((_, j) => j !== i))}
              className="ml-auto text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => setEtapas([...etapas, { dias: 7, quando: "antes" }])}
        className="mt-3 inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:bg-muted">
        <Plus className="h-3 w-3" /> Adicionar etapa
      </button>
      <SaveBar disabled={!dirty || saving} saving={saving} onSave={handleSave} />
    </SectionCard>
  );
}

/* ============================ 13. HISTÓRICO ============================ */
function HistoricoCard() {
  const fetchHist = useServerFn(getHistoricoDisparos);
  const reenviar = useServerFn(reenviarJob);
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<"todos" | "enviado" | "erro" | "pendente">("todos");
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const h: any = await fetchHist({ data: { status, busca, page } });
      setRows(h.rows); setTotal(h.total);
    } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [status, page]);

  return (
    <SectionCard icon={History} title="Histórico" desc="Todos os envios do motor, com status, erros e reenvio manual.">
      <div className="mb-3 flex flex-wrap gap-2">
        <select value={status} onChange={(e) => { setStatus(e.target.value as any); setPage(1); }}
          className="rounded-md border border-input bg-background px-2 py-1.5 text-xs">
          <option value="todos">Todos os status</option>
          <option value="pendente">Aguardando</option>
          <option value="enviado">Enviados</option>
          <option value="erro">Com erro</option>
        </select>
        <input value={busca} onChange={(e) => setBusca(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { setPage(1); void load(); } }}
          placeholder="Buscar por aluno…"
          className="min-w-[180px] flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-xs" />
        <button onClick={() => { setPage(1); void load(); }}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:bg-muted">
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-xs">
          <thead className="bg-muted/30 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Automação</th>
              <th className="text-left font-medium">Aluno</th>
              <th className="text-left font-medium">Programado</th>
              <th className="text-left font-medium">Efetivo</th>
              <th className="text-left font-medium">Status</th>
              <th className="pr-3 text-right font-medium">Ação</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Nenhum disparo registrado</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="border-t border-border/40">
                <td className="px-3 py-2 font-mono">{r.tipo}</td>
                <td>{r.aluno_nome}</td>
                <td className="text-muted-foreground">{new Date(r.agendado_para).toLocaleString("pt-BR")}</td>
                <td className="text-muted-foreground">{r.executado_em ? new Date(r.executado_em).toLocaleString("pt-BR") : "—"}</td>
                <td>
                  {r.executado
                    ? <Badge tone="emerald">Enviado</Badge>
                    : r.erro
                      ? <span title={r.erro}><Badge tone="destructive">Erro</Badge></span>
                      : <Badge tone="muted">Aguardando</Badge>}
                </td>
                <td className="pr-3 text-right">
                  {!r.executado && (
                    <button onClick={async () => {
                      try { await reenviar({ data: { jobId: r.id } }); toast.success("Job reagendado"); void load(); }
                      catch (e) { toast.error(e instanceof Error ? e.message : "Falha"); }
                    }}
                      className="rounded-md border border-border bg-background px-2 py-1 text-[10px] hover:bg-muted">
                      Reagendar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {total > 20 && (
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
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

/* ============================ UI HELPERS ============================ */
function SectionCard({ icon: Icon, title, desc, ultima, dirty, children }: {
  icon: any; title: string; desc: string; ultima?: ConfigItem; dirty?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-start gap-2 border-b border-border px-5 py-4">
        <Icon className="mt-0.5 h-4 w-4 text-primary" />
        <div>
          <h2 className="flex items-center gap-2 font-semibold">
            {title}
            {dirty && <span className="h-2 w-2 rounded-full bg-amber-500" title="Alterações não salvas" />}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
        </div>
      </div>
      <div className="p-5">{children}</div>
      {ultima && (
        <div className="border-t border-border bg-muted/20 px-5 py-2 text-[11px] text-muted-foreground">
          Última alteração: {ultima.atualizado_por_nome ?? "—"} — {new Date(ultima.atualizado_em).toLocaleString("pt-BR")}
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
        Salvar configurações
      </button>
    </div>
  );
}

function Badge({ tone, children }: { tone: "emerald" | "destructive" | "amber" | "muted"; children: React.ReactNode }) {
  const map = {
    emerald: "bg-emerald-500/15 text-emerald-600",
    destructive: "bg-destructive/15 text-destructive",
    amber: "bg-amber-500/15 text-amber-600",
    muted: "bg-muted text-muted-foreground",
  } as const;
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${map[tone]}`}>{children}</span>;
}

function Metric({ label, value, small }: { label: string; value: string | number; small?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={`mt-1 font-semibold ${small ? "text-xs" : "text-lg"}`}>{value}</div>
    </div>
  );
}

function Modal({ titulo, onClose, children }: { titulo: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl space-y-3 rounded-xl border border-border bg-card p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">{titulo}</h3>
          <button onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap rounded-md border border-border bg-muted/20 p-4 text-sm">
          {children || <span className="text-muted-foreground">(vazio)</span>}
        </div>
      </div>
    </div>
  );
}
