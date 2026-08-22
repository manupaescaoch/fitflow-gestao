import { Flame, Drumstick, Wheat, Droplet, Scale } from "lucide-react";
import { fmtMacro, gPerKg, type Macros } from "@/lib/dieta";

export function MacrosDashboard({
  total, meta, peso, vazio,
}: {
  total: Macros;
  meta: { kcal?: number | null; ptn_g_kg?: number | null; cho_g_kg?: number | null; lip_g_kg?: number | null };
  peso: number | null | undefined;
  vazio: boolean;
}) {
  const metaPtn = peso && meta.ptn_g_kg ? peso * meta.ptn_g_kg : null;
  const metaCho = peso && meta.cho_g_kg ? peso * meta.cho_g_kg : null;
  const metaLip = peso && meta.lip_g_kg ? peso * meta.lip_g_kg : null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
      <Card icon={<Flame className="w-3.5 h-3.5" />} label="kcal" value={total.kcal} meta={meta.kcal ?? null} unit="" tone="rose" vazio={vazio} />
      <Card icon={<Drumstick className="w-3.5 h-3.5" />} label="Proteína" value={total.ptn} meta={metaPtn} unit="g" tone="emerald" vazio={vazio} />
      <Card icon={<Wheat className="w-3.5 h-3.5" />} label="Carbo" value={total.cho} meta={metaCho} unit="g" tone="amber" vazio={vazio} />
      <Card icon={<Droplet className="w-3.5 h-3.5" />} label="Gordura" value={total.lip} meta={metaLip} unit="g" tone="violet" vazio={vazio} />
      <CardGkg ptn={total.ptn} cho={total.cho} lip={total.lip} peso={peso ?? null} vazio={vazio} />
    </div>
  );
}

const TONE: Record<string, { ring: string; bar: string; text: string }> = {
  rose:    { ring: "ring-rose-100",    bar: "bg-primary",    text: "text-rose-600" },
  emerald: { ring: "ring-emerald-100", bar: "bg-emerald-500", text: "text-emerald-600" },
  amber:   { ring: "ring-amber-100",   bar: "bg-amber-500",   text: "text-amber-600" },
  violet:  { ring: "ring-violet-100",  bar: "bg-violet-500",  text: "text-violet-600" },
  slate:   { ring: "ring-slate-100",   bar: "bg-slate-500",   text: "text-slate-600" },
};

function Card({ icon, label, value, meta, unit, tone, vazio }: {
  icon: React.ReactNode; label: string; value: number; meta: number | null; unit: string; tone: keyof typeof TONE; vazio: boolean;
}) {
  const t = TONE[tone];
  const pct = meta ? Math.min(150, (value / meta) * 100) : 0;
  const over = meta && value > meta * 1.05;
  return (
    <div className={`rounded-xl bg-card shadow-sm ring-1 ${t.ring} px-3.5 py-3`}>
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground uppercase tracking-wide">
        <span className={t.text}>{icon}</span>{label}
      </div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className="text-2xl font-semibold tabular-nums tracking-tight">{vazio ? "—" : fmtMacro(value)}</span>
        {unit && !vazio && <span className="text-xs text-muted-foreground">{unit}</span>}
      </div>
      {meta ? (
        <div className="mt-2">
          <div className="h-1 rounded-full bg-muted overflow-hidden">
            <div className={`h-full ${over ? "bg-primary" : t.bar} transition-all`} style={{ width: `${Math.min(100, pct)}%` }} />
          </div>
          <div className="mt-1 text-[10px] text-muted-foreground tabular-nums">
            meta {fmtMacro(meta)}{unit} · {pct.toFixed(0)}%
          </div>
        </div>
      ) : (
        <div className="mt-2 h-1 rounded-full bg-muted/60" />
      )}
    </div>
  );
}

function CardGkg({ ptn, cho, lip, peso, vazio }: { ptn: number; cho: number; lip: number; peso: number | null; vazio: boolean }) {
  return (
    <div className="rounded-xl bg-card shadow-sm ring-1 ring-slate-100 px-3.5 py-3">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground uppercase tracking-wide">
        <Scale className="w-3.5 h-3.5 text-slate-500" /> g/kg
      </div>
      {vazio || !peso ? (
        <div className="mt-1.5 text-2xl font-semibold tabular-nums text-muted-foreground">—</div>
      ) : (
        <div className="mt-1.5 space-y-1 text-xs tabular-nums">
          <Row k="P" v={gPerKg(ptn, peso)} c="text-emerald-600" />
          <Row k="C" v={gPerKg(cho, peso)} c="text-amber-600" />
          <Row k="G" v={gPerKg(lip, peso)} c="text-violet-600" />
        </div>
      )}
    </div>
  );
}

function Row({ k, v, c }: { k: string; v: string; c: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className={`text-[10px] font-semibold ${c}`}>{k}</span>
      <span className="font-semibold">{v}</span>
    </div>
  );
}
