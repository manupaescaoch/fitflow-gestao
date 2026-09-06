import { useEffect, useRef, useState } from "react";
import { Star, Upload, Eraser, Loader2, Paperclip } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { TIPOS_OPCOES, type Pergunta } from "@/lib/formularios";

interface Props {
  pergunta: Pergunta;
  valor: unknown;
  onChange: (v: unknown) => void;
  cor: string;
  erro?: string | null;
  disabled?: boolean;
}

const OUTRO = "__outro__";

export function CampoResposta({ pergunta: p, valor, onChange, cor, erro, disabled }: Props) {
  const cfg = p.config ?? {};
  const opcoes = TIPOS_OPCOES.includes(p.tipo) ? (p.opcoes ?? []) : [];
  const base =
    "w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-ring";

  if (p.tipo === "titulo_secao") {
    return <h3 className="text-lg font-bold text-foreground">{p.titulo}</h3>;
  }
  if (p.tipo === "separador") return <hr className="border-border" />;
  if (p.tipo === "texto_info") {
    return <p className="text-sm text-muted-foreground whitespace-pre-line">{p.descricao || p.titulo}</p>;
  }

  const campo = () => {
    switch (p.tipo) {
      case "texto_longo":
        return (
          <Textarea
            value={String(valor ?? "")}
            placeholder={cfg.placeholder ?? ""}
            rows={4}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
          />
        );
      case "numero":
        return (
          <Input type="number" inputMode="decimal" disabled={disabled}
            value={String(valor ?? "")} placeholder={cfg.placeholder ?? ""}
            min={cfg.min ?? undefined} max={cfg.max ?? undefined}
            onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))} />
        );
      case "email":
        return <Input type="email" inputMode="email" autoComplete="email" disabled={disabled}
          value={String(valor ?? "")} onChange={(e) => onChange(e.target.value)} />;
      case "telefone":
        return <Input type="tel" inputMode="tel" autoComplete="tel" disabled={disabled}
          value={String(valor ?? "")} placeholder="(00) 00000-0000" onChange={(e) => onChange(e.target.value)} />;
      case "data":
        return <Input type="date" disabled={disabled} value={String(valor ?? "")} onChange={(e) => onChange(e.target.value)} />;
      case "hora":
        return <Input type="time" disabled={disabled} value={String(valor ?? "")} onChange={(e) => onChange(e.target.value)} />;
      case "sim_nao":
        return (
          <div className="flex gap-2">
            {["Sim", "Não"].map((op) => {
              const ativo = valor === op;
              return (
                <button key={op} type="button" disabled={disabled}
                  onClick={() => onChange(ativo ? "" : op)}
                  className={`flex-1 rounded-md border px-4 py-3 text-sm font-medium transition-colors ${
                    ativo ? "border-transparent text-white" : "border-input hover:bg-muted/50"
                  }`}
                  style={ativo ? { backgroundColor: cor } : undefined}>
                  {op}
                </button>
              );
            })}
          </div>
        );
      case "multipla_escolha":
      case "caixas": {
        const multi = p.tipo === "caixas";
        const arr = Array.isArray(valor) ? (valor as string[]) : [];
        const outroValor = multi
          ? arr.find((v) => v.startsWith("Outro: "))
          : typeof valor === "string" && valor.startsWith("Outro: ") ? valor : undefined;
        const toggle = (label: string) => {
          if (multi) {
            onChange(arr.includes(label) ? arr.filter((x) => x !== label) : [...arr, label]);
          } else {
            onChange(valor === label ? "" : label);
          }
        };
        const setOutro = (txt: string) => {
          const novo = `Outro: ${txt}`;
          if (multi) {
            const semOutro = arr.filter((x) => !x.startsWith("Outro: "));
            onChange(txt ? [...semOutro, novo] : semOutro);
          } else onChange(txt ? novo : "");
        };
        const marcado = (label: string) => (multi ? arr.includes(label) : valor === label);
        return (
          <div className="space-y-2">
            {opcoes.map((o) => (
              <button key={o.id} type="button" disabled={disabled} onClick={() => toggle(o.label)}
                className={`flex w-full items-center gap-3 rounded-md border px-3 py-3 text-left text-sm transition-colors ${
                  marcado(o.label) ? "border-transparent bg-muted/60" : "border-input hover:bg-muted/40"
                }`}>
                <span className={`h-4 w-4 shrink-0 border ${multi ? "rounded" : "rounded-full"}`}
                  style={marcado(o.label) ? { backgroundColor: cor, borderColor: cor } : { borderColor: "hsl(var(--border))" }} />
                <span>{o.label}</span>
              </button>
            ))}
            {cfg.permitirOutro && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Outro:</span>
                <Input disabled={disabled} value={(outroValor ?? "").replace(/^Outro: /, "")}
                  onChange={(e) => setOutro(e.target.value)} placeholder="Sua resposta" />
              </div>
            )}
          </div>
        );
      }
      case "lista":
        return (
          <select className={base} disabled={disabled} value={String(valor ?? "")} onChange={(e) => onChange(e.target.value)}>
            <option value="">Selecione…</option>
            {opcoes.map((o) => <option key={o.id} value={o.label}>{o.label}</option>)}
            {cfg.permitirOutro && <option value={OUTRO}>Outro</option>}
          </select>
        );
      case "escala":
      case "nps": {
        const min = p.tipo === "nps" ? 0 : (cfg.escalaMin ?? 1);
        const max = p.tipo === "nps" ? 10 : (cfg.escalaMax ?? 5);
        const nums = Array.from({ length: max - min + 1 }, (_, i) => min + i);
        return (
          <div>
            <div className="flex flex-wrap gap-1.5">
              {nums.map((n) => {
                const ativo = Number(valor) === n;
                return (
                  <button key={n} type="button" disabled={disabled} onClick={() => onChange(ativo ? "" : n)}
                    className={`h-10 min-w-10 flex-1 rounded-md border text-sm font-medium transition-colors ${
                      ativo ? "border-transparent text-white" : "border-input hover:bg-muted/50"
                    }`}
                    style={ativo ? { backgroundColor: cor } : undefined}>
                    {n}
                  </button>
                );
              })}
            </div>
            {(cfg.rotuloMin || cfg.rotuloMax) && (
              <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                <span>{cfg.rotuloMin}</span><span>{cfg.rotuloMax}</span>
              </div>
            )}
          </div>
        );
      }
      case "estrelas": {
        const total = cfg.escalaMax ?? 5;
        return (
          <div className="flex gap-1">
            {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
              <button key={n} type="button" disabled={disabled} onClick={() => onChange(Number(valor) === n ? "" : n)}
                aria-label={`${n} estrelas`} className="p-1">
                <Star className="h-7 w-7" style={{ color: cor }} fill={Number(valor) >= n ? cor : "transparent"} />
              </button>
            ))}
          </div>
        );
      }
      case "arquivo":
        return <UploadArquivo valor={valor} onChange={onChange} disabled={disabled} multiplos={!!cfg.multiplos} />;
      case "assinatura":
        return <Assinatura valor={String(valor ?? "")} onChange={onChange} disabled={disabled} />;
      default:
        return <Input disabled={disabled} value={String(valor ?? "")} placeholder={cfg.placeholder ?? ""}
          onChange={(e) => onChange(e.target.value)} />;
    }
  };

  return (
    <div className="space-y-2">
      <div>
        <label className="text-sm font-medium text-foreground">
          {p.titulo} {p.obrigatoria && <span style={{ color: cor }}>*</span>}
        </label>
        {p.descricao && <p className="mt-0.5 text-xs text-muted-foreground">{p.descricao}</p>}
      </div>
      {campo()}
      {erro && <p className="text-xs font-medium text-destructive">{erro}</p>}
    </div>
  );
}

function UploadArquivo({ valor, onChange, disabled, multiplos }: {
  valor: unknown; onChange: (v: unknown) => void; disabled?: boolean; multiplos: boolean;
}) {
  const [enviando, setEnviando] = useState(false);
  const arquivos = Array.isArray(valor) ? (valor as { nome: string; path: string }[]) : [];

  async function handle(files: FileList | null) {
    if (!files?.length) return;
    setEnviando(true);
    const novos = [...arquivos];
    for (const file of Array.from(files)) {
      const path = `respostas/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const { error } = await supabase.storage.from("formularios").upload(path, file);
      if (!error) novos.push({ nome: file.name, path });
    }
    onChange(multiplos ? novos : novos.slice(-1));
    setEnviando(false);
  }

  return (
    <div className="space-y-2">
      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-input px-4 py-6 text-sm text-muted-foreground hover:bg-muted/40">
        {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {enviando ? "Enviando…" : "Selecionar arquivo"}
        <input type="file" className="hidden" multiple={multiplos} disabled={disabled || enviando}
          onChange={(e) => void handle(e.target.files)} />
      </label>
      {arquivos.map((a) => (
        <div key={a.path} className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-xs">
          <Paperclip className="h-3.5 w-3.5" /> <span className="truncate">{a.nome}</span>
          <button type="button" className="ml-auto text-muted-foreground hover:text-destructive"
            onClick={() => onChange(arquivos.filter((x) => x.path !== a.path))}>Remover</button>
        </div>
      ))}
    </div>
  );
}

function Assinatura({ valor, onChange, disabled }: { valor: string; onChange: (v: unknown) => void; disabled?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const desenhando = useRef(false);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111827";
    if (valor) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = valor;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pos = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  return (
    <div className="space-y-2">
      <canvas
        ref={ref} width={600} height={180}
        className="w-full touch-none rounded-md border border-input bg-background"
        onPointerDown={(e) => {
          if (disabled) return;
          desenhando.current = true;
          const ctx = ref.current!.getContext("2d")!;
          const { x, y } = pos(e);
          ctx.beginPath(); ctx.moveTo(x, y);
        }}
        onPointerMove={(e) => {
          if (!desenhando.current) return;
          const ctx = ref.current!.getContext("2d")!;
          const { x, y } = pos(e);
          ctx.lineTo(x, y); ctx.stroke();
        }}
        onPointerUp={() => {
          if (!desenhando.current) return;
          desenhando.current = false;
          onChange(ref.current!.toDataURL("image/png"));
        }}
      />
      <Button type="button" variant="outline" size="sm" disabled={disabled}
        onClick={() => {
          const c = ref.current!;
          c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
          onChange("");
        }}>
        <Eraser className="mr-2 h-3.5 w-3.5" /> Limpar assinatura
      </Button>
    </div>
  );
}
