import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";

/**
 * Lista de países com DDI. Brasil em primeiro como padrão.
 * code = DDI sem o "+".
 */
export const COUNTRIES: { name: string; code: string; flag: string }[] = [
  { name: "Brasil", code: "55", flag: "🇧🇷" },
  { name: "Portugal", code: "351", flag: "🇵🇹" },
  { name: "Estados Unidos", code: "1", flag: "🇺🇸" },
  { name: "Argentina", code: "54", flag: "🇦🇷" },
  { name: "Uruguai", code: "598", flag: "🇺🇾" },
  { name: "Paraguai", code: "595", flag: "🇵🇾" },
  { name: "Chile", code: "56", flag: "🇨🇱" },
  { name: "Colômbia", code: "57", flag: "🇨🇴" },
  { name: "México", code: "52", flag: "🇲🇽" },
  { name: "Peru", code: "51", flag: "🇵🇪" },
  { name: "Bolívia", code: "591", flag: "🇧🇴" },
  { name: "Venezuela", code: "58", flag: "🇻🇪" },
  { name: "Equador", code: "593", flag: "🇪🇨" },
  { name: "Espanha", code: "34", flag: "🇪🇸" },
  { name: "Itália", code: "39", flag: "🇮🇹" },
  { name: "França", code: "33", flag: "🇫🇷" },
  { name: "Alemanha", code: "49", flag: "🇩🇪" },
  { name: "Reino Unido", code: "44", flag: "🇬🇧" },
  { name: "Irlanda", code: "353", flag: "🇮🇪" },
  { name: "Países Baixos", code: "31", flag: "🇳🇱" },
  { name: "Bélgica", code: "32", flag: "🇧🇪" },
  { name: "Suíça", code: "41", flag: "🇨🇭" },
  { name: "Áustria", code: "43", flag: "🇦🇹" },
  { name: "Canadá", code: "1", flag: "🇨🇦" },
  { name: "Japão", code: "81", flag: "🇯🇵" },
  { name: "China", code: "86", flag: "🇨🇳" },
  { name: "Coreia do Sul", code: "82", flag: "🇰🇷" },
  { name: "Austrália", code: "61", flag: "🇦🇺" },
  { name: "Nova Zelândia", code: "64", flag: "🇳🇿" },
  { name: "África do Sul", code: "27", flag: "🇿🇦" },
  { name: "Angola", code: "244", flag: "🇦🇴" },
  { name: "Moçambique", code: "258", flag: "🇲🇿" },
];

const DEFAULT_DDI = "55";
const KNOWN_DDIS = Array.from(new Set(COUNTRIES.map((c) => c.code))).sort((a, b) => b.length - a.length);

const RED = "#F70906";
const INK = "#0a0a0a";
const BORDER = "#e5e5e5";
const SURFACE = "#ffffff";
const MUTED = "#737373";

function onlyDigits(s: string): string {
  return (s || "").replace(/\D/g, "");
}

/** Recebe E.164 sem "+" (ex: 5581999999999) e separa DDI + número. */
export function splitPhone(full: string): { ddi: string; numero: string } {
  const d = onlyDigits(full);
  if (!d) return { ddi: DEFAULT_DDI, numero: "" };
  for (const code of KNOWN_DDIS) {
    if (d.startsWith(code) && d.length > code.length) {
      return { ddi: code, numero: d.slice(code.length) };
    }
  }
  // fallback: assume Brasil
  return { ddi: DEFAULT_DDI, numero: d };
}

/** Junta DDI + número. */
export function joinPhone(ddi: string, numero: string): string {
  return onlyDigits(ddi) + onlyDigits(numero);
}

function inputStyle(hasError?: boolean): React.CSSProperties {
  return { backgroundColor: SURFACE, border: `1px solid ${hasError ? RED : BORDER}`, color: INK, fontSize: 16 };
}

interface DdiSelectProps {
  value: string;
  onChange: (ddi: string) => void;
  error?: boolean;
}

function DdiSelect({ value, onChange, error }: DdiSelectProps) {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const selecionado = useMemo(
    () => COUNTRIES.find((c) => c.code === value) ?? COUNTRIES[0],
    [value],
  );

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.includes(q.replace(/\D/g, "")) ||
        ("+" + c.code).includes(q),
    );
  }, [busca]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full px-3.5 py-3 text-base rounded-md outline-none transition flex items-center justify-between gap-2"
        style={inputStyle(error)}
      >
        <span className="flex items-center gap-2 truncate">
          <span className="text-lg leading-none">{selecionado.flag}</span>
          <span className="truncate">{selecionado.name}</span>
          <span className="font-semibold" style={{ color: INK }}>+{selecionado.code}</span>
        </span>
        <ChevronDown size={18} style={{ color: MUTED }} />
      </button>
      {open && (
        <div
          className="absolute z-50 mt-1 w-full rounded-md shadow-lg overflow-hidden"
          style={{ backgroundColor: SURFACE, border: `1px solid ${BORDER}` }}
        >
          <div className="p-2 border-b" style={{ borderColor: BORDER }}>
            <div className="flex items-center gap-2 px-2 py-1.5 rounded" style={{ backgroundColor: "#f7f7f7" }}>
              <Search size={16} style={{ color: MUTED }} />
              <input
                autoFocus
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar país ou código"
                className="w-full bg-transparent outline-none text-sm"
                style={{ color: INK }}
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {filtrados.length === 0 ? (
              <div className="px-3 py-3 text-sm" style={{ color: MUTED }}>Nenhum país encontrado</div>
            ) : (
              filtrados.map((c) => (
                <button
                  type="button"
                  key={`${c.name}-${c.code}`}
                  onClick={() => { onChange(c.code); setOpen(false); setBusca(""); }}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-[#f7f7f7] text-sm"
                  style={{ color: INK }}
                >
                  <span className="flex items-center gap-2 truncate">
                    <span className="text-base leading-none">{c.flag}</span>
                    <span className="truncate">{c.name}</span>
                  </span>
                  <span className="font-semibold" style={{ color: INK }}>+{c.code}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface PhoneDdiInputProps {
  /** Valor completo (DDI + número, só dígitos). Ex: "5581999999999" */
  value: string;
  onChange: (full: string) => void;
  /** DDI controlado externamente (compartilhado entre campo e confirmação). Opcional. */
  ddi?: string;
  onDdiChange?: (ddi: string) => void;
  /** Quando true, oculta o seletor de DDI (útil no campo "confirmar telefone"). */
  hideDdi?: boolean;
  placeholder?: string;
  error?: string;
  /** Label do campo de número. */
  numeroLabel?: string;
}

/**
 * Campo de telefone com seletor de DDI + número com DDD.
 *
 * `value` é o telefone completo em E.164 sem "+", ex: "5581999999999".
 * O componente cuida de separar/juntar DDI e número.
 */
export function PhoneDdiInput({
  value,
  onChange,
  ddi: ddiControlled,
  onDdiChange,
  hideDdi,
  placeholder = "Ex: 81999999999",
  error,
  numeroLabel,
}: PhoneDdiInputProps) {
  const split = useMemo(() => splitPhone(value), [value]);
  const ddi = ddiControlled ?? split.ddi;
  const numero = split.numero;

  function setDdi(novo: string) {
    onDdiChange?.(novo);
    onChange(joinPhone(novo, numero));
  }
  function setNumero(novo: string) {
    const limpo = onlyDigits(novo);
    onChange(joinPhone(ddi, limpo));
  }

  return (
    <div>
      {numeroLabel && (
        <label className="block text-sm font-semibold mb-1.5" style={{ color: INK }}>{numeroLabel}</label>
      )}
      <div className="flex items-stretch gap-2">
        {!hideDdi && (
          <div className="shrink-0 w-[140px] sm:w-[170px]">
            <DdiSelect value={ddi} onChange={setDdi} />
          </div>
        )}
        <input
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          value={numero}
          onChange={(e) => setNumero(e.target.value)}
          onKeyDown={(e) => {
            if (
              e.key.length === 1 &&
              !/[0-9]/.test(e.key) &&
              !e.metaKey && !e.ctrlKey && !e.altKey
            ) {
              e.preventDefault();
            }
          }}
          placeholder={placeholder}
          className="flex-1 min-w-0 px-3.5 py-3 text-base rounded-md outline-none transition"
          style={inputStyle(!!error)}
        />
      </div>
      {error && (
        <p data-error="true" className="mt-1 text-xs font-medium" style={{ color: RED }}>{error}</p>
      )}
    </div>
  );
}