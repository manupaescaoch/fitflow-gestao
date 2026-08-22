import { useState } from "react";
import { X, Sparkles, Loader2, ChevronRight, ChevronLeft, Target, Activity, SlidersHorizontal, Check } from "lucide-react";

export type WizardInput = {
  objetivo: "emagrecer" | "manter" | "hipertrofia";
  peso: number;
  altura?: number;
  atividade: "sedentario" | "leve" | "moderado" | "intenso";
  refeicoes: number;
  modo: "simples" | "avancado";
  deficit_pct?: number;
  ptn_g_kg?: number;
  cho_g_kg?: number;
  lip_g_kg?: number;
  meta_kcal?: number;
  regiao?: string;
  restricoes?: string;
};

export function WizardMpDiet({
  open, onClose, onSubmit, busy, defaults,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: WizardInput) => void;
  busy: boolean;
  defaults?: Partial<WizardInput>;
}) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardInput>({
    objetivo: "manter",
    peso: 75,
    atividade: "moderado",
    refeicoes: 5,
    modo: "simples",
    deficit_pct: 0,
    ptn_g_kg: 1.8,
    cho_g_kg: 3,
    lip_g_kg: 0.8,
    ...defaults,
  });

  if (!open) return null;

  function set<K extends keyof WizardInput>(k: K, v: WizardInput[K]) { setData((d) => ({ ...d, [k]: v })); }

  const STEPS = ["Objetivo", "Dados base", "Estratégia", "Revisão"];

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 px-safe">
      <div className="bg-background w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-3 border-b border-border">
          <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-rose-600" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold">MP DIET</div>
            <div className="text-[11px] text-muted-foreground">Assistente de prescrição nutricional</div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-5 pt-4">
          <div className="flex items-center gap-2">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold ${
                  i < step ? "bg-emerald-500 text-white" : i === step ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                }`}>
                  {i < step ? <Check className="w-3 h-3" /> : i + 1}
                </div>
                <span className={`text-xs ${i === step ? "font-medium" : "text-muted-foreground"}`}>{s}</span>
                {i < STEPS.length - 1 && <div className="flex-1 h-px bg-border" />}
              </div>
            ))}
          </div>
        </div>

        <div className="px-5 py-5 min-h-[280px]">
          {step === 0 && (
            <div>
              <h3 className="text-base font-semibold mb-3">Qual o objetivo?</h3>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { v: "emagrecer", l: "Emagrecer", d: "Déficit calórico controlado" },
                  { v: "manter", l: "Manter", d: "Manutenção e qualidade" },
                  { v: "hipertrofia", l: "Hipertrofia", d: "Superávit + alta proteína" },
                ].map((opt) => (
                  <button
                    key={opt.v}
                    onClick={() => set("objetivo", opt.v as WizardInput["objetivo"])}
                    className={`p-3 rounded-xl border text-left transition ${
                      data.objetivo === opt.v ? "border-rose-500 bg-rose-50/60 ring-2 ring-rose-100" : "border-border hover:border-rose-300"
                    }`}
                  >
                    <Target className="w-4 h-4 mb-1.5 text-rose-600" />
                    <div className="font-medium text-sm">{opt.l}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{opt.d}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <h3 className="text-base font-semibold mb-3">Dados base</h3>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Peso (kg)"><input type="number" value={data.peso} onChange={(e) => set("peso", Number(e.target.value))} className="input" /></Field>
                <Field label="Altura (cm)"><input type="number" value={data.altura ?? ""} onChange={(e) => set("altura", e.target.value ? Number(e.target.value) : undefined)} className="input" /></Field>
                <Field label="Atividade">
                  <select value={data.atividade} onChange={(e) => set("atividade", e.target.value as WizardInput["atividade"])} className="input">
                    <option value="sedentario">Sedentário</option>
                    <option value="leve">Leve</option>
                    <option value="moderado">Moderado</option>
                    <option value="intenso">Intenso</option>
                  </select>
                </Field>
                <Field label="Refeições/dia"><input type="number" min={2} max={8} value={data.refeicoes} onChange={(e) => set("refeicoes", Number(e.target.value))} className="input" /></Field>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold">Estratégia nutricional</h3>
                <div className="inline-flex rounded-lg border border-border p-0.5 text-xs">
                  <button onClick={() => set("modo", "simples")} className={`px-2.5 py-1 rounded-md ${data.modo === "simples" ? "bg-primary text-white" : "text-muted-foreground"}`}>Simples</button>
                  <button onClick={() => set("modo", "avancado")} className={`px-2.5 py-1 rounded-md ${data.modo === "avancado" ? "bg-primary text-white" : "text-muted-foreground"}`}>Avançado</button>
                </div>
              </div>
              {data.modo === "simples" ? (
                <div className="space-y-3">
                  <Field label="Déficit/superávit (%)"><input type="number" value={data.deficit_pct ?? 0} onChange={(e) => set("deficit_pct", Number(e.target.value))} className="input" /></Field>
                  <Field label="Restrições / preferências"><input value={data.restricoes ?? ""} onChange={(e) => set("restricoes", e.target.value)} placeholder="Ex.: sem lactose, vegetariano…" className="input" /></Field>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Proteína (g/kg)"><input type="number" step="0.1" value={data.ptn_g_kg ?? ""} onChange={(e) => set("ptn_g_kg", Number(e.target.value))} className="input" /></Field>
                  <Field label="Carbo (g/kg)"><input type="number" step="0.1" value={data.cho_g_kg ?? ""} onChange={(e) => set("cho_g_kg", Number(e.target.value))} className="input" /></Field>
                  <Field label="Gordura (g/kg)"><input type="number" step="0.1" value={data.lip_g_kg ?? ""} onChange={(e) => set("lip_g_kg", Number(e.target.value))} className="input" /></Field>
                  <Field label="Meta kcal (opcional)"><input type="number" value={data.meta_kcal ?? ""} onChange={(e) => set("meta_kcal", e.target.value ? Number(e.target.value) : undefined)} className="input" /></Field>
                  <Field label="Estilo / região" full><input value={data.regiao ?? ""} onChange={(e) => set("regiao", e.target.value)} placeholder="Brasileira, mediterrânea, low-carb…" className="input" /></Field>
                  <Field label="Restrições" full><input value={data.restricoes ?? ""} onChange={(e) => set("restricoes", e.target.value)} placeholder="Ex.: sem lactose, vegetariano…" className="input" /></Field>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div>
              <h3 className="text-base font-semibold mb-3">Revisão</h3>
              <div className="rounded-xl bg-muted/40 p-4 space-y-2 text-sm">
                <Row k="Objetivo" v={data.objetivo} />
                <Row k="Peso" v={`${data.peso} kg`} />
                <Row k="Atividade" v={data.atividade} />
                <Row k="Refeições/dia" v={String(data.refeicoes)} />
                <Row k="Modo" v={data.modo} />
                {data.modo === "simples" && <Row k="Déficit/superávit" v={`${data.deficit_pct ?? 0}%`} />}
                {data.modo === "avancado" && (
                  <>
                    <Row k="P/C/G g/kg" v={`${data.ptn_g_kg} / ${data.cho_g_kg} / ${data.lip_g_kg}`} />
                    {data.meta_kcal ? <Row k="Meta kcal" v={String(data.meta_kcal)} /> : null}
                    {data.regiao ? <Row k="Estilo" v={data.regiao} /> : null}
                  </>
                )}
                {data.restricoes ? <Row k="Restrições" v={data.restricoes} /> : null}
              </div>
              <p className="text-[11px] text-muted-foreground mt-3">A IA vai usar estas informações para montar o plano. Você pode ajustar tudo depois.</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-border bg-muted/20">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0 || busy}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm hover:bg-muted disabled:opacity-40"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Voltar
          </button>
          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              className="inline-flex items-center gap-1 px-4 py-1.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90"
            >
              Avançar <ChevronRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={() => onSubmit(data)}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              Gerar plano
            </button>
          )}
        </div>
      </div>

      <style>{`.input { width:100%; padding:0.5rem 0.625rem; border-radius:0.5rem; border:1px solid hsl(var(--border)); background:hsl(var(--background)); font-size:0.875rem; outline:none; }
      .input:focus { border-color:rgb(244 63 94 / 0.5); box-shadow:0 0 0 3px rgb(254 226 226); }`}</style>
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={`block ${full ? "col-span-2" : ""}`}>
      <span className="block text-[11px] uppercase tracking-wide text-muted-foreground mb-1">{label}</span>
      {children}
    </label>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-xs text-muted-foreground">{k}</span>
      <span className="font-medium capitalize">{v}</span>
    </div>
  );
}
