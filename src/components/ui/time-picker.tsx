import { Clock } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";

interface TimePickerProps {
  value: string; // "HH:mm"
  onChange: (value: string) => void;
  className?: string;
  minuteStep?: number;
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function parse(value: string): { h: number; m: number } {
  const m = /^(\d{1,2}):(\d{1,2})/.exec(value ?? "");
  if (!m) return { h: 7, m: 0 };
  const h = Math.min(23, Math.max(0, parseInt(m[1], 10) || 0));
  const min = Math.min(59, Math.max(0, parseInt(m[2], 10) || 0));
  return { h, m: min };
}

export function TimePicker({ value, onChange, className, minuteStep = 5 }: TimePickerProps) {
  const { h, m } = useMemo(() => parse(value), [value]);

  const horas = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
  const minutos = useMemo(
    () => Array.from({ length: Math.ceil(60 / minuteStep) }, (_, i) => i * minuteStep),
    [minuteStep],
  );

  const setH = (nh: number) => onChange(`${pad(nh)}:${pad(m)}`);
  const setM = (nm: number) => onChange(`${pad(h)}:${pad(nm)}`);

  return (
    <div
      className={
        "relative inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2 shadow-sm " +
        (className ?? "")
      }
    >
      <Clock className="h-5 w-5 text-rose-500 shrink-0" />
      <div className="relative flex items-center gap-1">
        {/* Faixa central destacando o item selecionado */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 h-8 rounded-lg bg-rose-50/70 ring-1 ring-rose-100"
        />
        {/* Fades de topo e base */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-4 bg-gradient-to-b from-white to-transparent z-10"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-white to-transparent z-10"
        />
        <ScrollColumn items={horas} value={h} onChange={setH} />
        <span className="text-2xl font-semibold text-slate-400 leading-none px-0.5">:</span>
        <ScrollColumn items={minutos} value={m} onChange={setM} />
      </div>
    </div>
  );
}

const ITEM_H = 32;

function ScrollColumn({
  items,
  value,
  onChange,
}: {
  items: number[];
  value: number;
  onChange: (v: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const idx = items.indexOf(value);
    if (idx < 0) return;
    el.scrollTo({ top: idx * ITEM_H, behavior: "smooth" });
  }, [value, items]);

  function handleScroll() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const idx = Math.round(el.scrollTop / ITEM_H);
      const clamped = Math.max(0, Math.min(items.length - 1, idx));
      const next = items[clamped];
      if (next !== value) onChange(next);
      el.scrollTo({ top: clamped * ITEM_H, behavior: "smooth" });
    }, 120);
  }

  return (
    <div
      ref={ref}
      onScroll={handleScroll}
      className="time-scroll relative h-[96px] w-12 overflow-y-auto snap-y snap-mandatory rounded-md"
    >
      <div style={{ height: ITEM_H }} aria-hidden />
      {items.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={
            "snap-center flex items-center justify-center w-full text-2xl font-semibold tabular-nums leading-none transition-all duration-150 " +
            (n === value
              ? "text-rose-600 scale-105"
              : "text-slate-300 hover:text-slate-500")
          }
          style={{ height: ITEM_H }}
        >
          {pad(n)}
        </button>
      ))}
      <div style={{ height: ITEM_H }} aria-hidden />
    </div>
  );
}