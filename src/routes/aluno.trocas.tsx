import { createFileRoute } from "@tanstack/react-router";
import {
  Sparkles,
  Paperclip,
  Drumstick,
  Egg,
  Soup,
  Fish,
  Banana,
  Leaf,
  Wheat,
  Package,
  ChevronRight,
  Info,
  Loader2,
  X,
  ArrowRight,
  Beef,
  Flame,
} from "lucide-react";
type SubItem = {
  descricao: string;
  kcal: number;
  ptn: number;
  cho: number;
  gord: number;
  tag?: string;
};
type RespostaIA = {
  referencia: SubItem;
  substituicoes: SubItem[];
};

function tagStyle(tag?: string) {
  if (!tag) return null;
  const t = tag.toLowerCase();
  if (t.includes("proteína") || t.includes("proteina") || t.includes("high protein"))
    return { bg: "bg-[#DBEAFE]", text: "text-[#1D4ED8]", icon: Beef, ring: "ring-[#BFDBFE]" };
  if (t.includes("menos kcal") || t.includes("low cal"))
    return { bg: "bg-[#DCFCE7]", text: "text-[#15803D]", icon: Flame, ring: "ring-[#BBF7D0]" };
  if (t.includes("low carb"))
    return { bg: "bg-[#FEF3C7]", text: "text-[#B45309]", icon: Wheat, ring: "ring-[#FDE68A]" };
  if (t.includes("vegan") || t.includes("vegetar"))
    return { bg: "bg-[#DCFCE7]", text: "text-[#15803D]", icon: Leaf, ring: "ring-[#BBF7D0]" };
  if (t.includes("pré") || t.includes("pre treino") || t.includes("pós") || t.includes("pos treino"))
    return { bg: "bg-[#EDE9FE]", text: "text-[#6D28D9]", icon: Sparkles, ring: "ring-[#DDD6FE]" };
  return { bg: "bg-black/5", text: "text-black/70", icon: Sparkles, ring: "ring-black/10" };
}

function fmt(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, "");
}

function respostaToText(d: RespostaIA): string {
  const ref = d.referencia;
  const head = `[REFERÊNCIA] ${ref.descricao} ≈ ${fmt(ref.kcal)} kcal | PTN ${fmt(ref.ptn)}g | CHO ${fmt(ref.cho)}g | GORD ${fmt(ref.gord)}g`;
  const linhas = d.substituicoes.map(
    (s) =>
      `• ${s.descricao}${s.tag ? ` (${s.tag})` : ""} ≈ ${fmt(s.kcal)} kcal | PTN ${fmt(s.ptn)}g | CHO ${fmt(s.cho)}g | GORD ${fmt(s.gord)}g`,
  );
  return [head, "", ...linhas].join("\n");
}

function MacroPills({ item }: { item: SubItem }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="px-2 py-0.5 rounded-full bg-[#FEE2E2] text-[#B91C1C] text-[11px] font-bold">
        {fmt(item.ptn)}g P
      </span>
      <span className="px-2 py-0.5 rounded-full bg-[#FFEDD5] text-[#C2410C] text-[11px] font-bold">
        {fmt(item.cho)}g C
      </span>
      <span className="px-2 py-0.5 rounded-full bg-[#FEF9C3] text-[#A16207] text-[11px] font-bold">
        {fmt(item.gord)}g G
      </span>
    </div>
  );
}

function SubCard({ item, destaqueKcal }: { item: SubItem; destaqueKcal?: boolean }) {
  const ts = tagStyle(item.tag);
  return (
    <div
      className={`rounded-2xl p-3 ${
        ts ? "bg-[#F0FDF4] ring-1 ring-[#DCFCE7]" : "bg-black/[0.03]"
      }`}
    >
      {ts && item.tag && (
        <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full ${ts.bg} ${ts.text} ring-1 ${ts.ring} mb-2`}>
          <ts.icon className="h-3 w-3" strokeWidth={2.4} />
          <span className="text-[11px] font-bold">{item.tag}</span>
        </div>
      )}
      <div className="flex items-start gap-2">
        <ArrowRight className={`h-4 w-4 mt-0.5 shrink-0 ${ts ? "text-[#16A34A]" : "text-[#F70906]"}`} strokeWidth={2.6} />
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-semibold text-black leading-snug">{item.descricao}</div>
          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
            <div className="flex items-baseline gap-1">
              <span className={`text-[20px] font-extrabold tabular-nums ${destaqueKcal ? "text-[#16A34A]" : "text-black"}`}>
                {fmt(item.kcal)}
              </span>
              <span className="text-[11px] text-black/45 font-medium">kcal</span>
            </div>
            <MacroPills item={item} />
          </div>
        </div>
      </div>
    </div>
  );
}
import { useRef, useState } from "react";
import { useAlunoSession } from "@/lib/aluno-session";
import { useServerFn } from "@tanstack/react-start";
import { gerarTrocasIA } from "@/server/trocas-ia.functions";
import { toast } from "sonner";
import { ProfileAvatar } from "@/components/aluno-app/ProfileAvatar";

export const Route = createFileRoute("/aluno/trocas")({
  component: AlunoTrocas,
});

const sugestoes = [
  { label: "150g frango grelhado", icon: Drumstick },
  { label: "2 ovos cozidos", icon: Egg },
  { label: "100g arroz branco", icon: Soup },
  { label: "150g salmão", icon: Fish },
  { label: "banana média", icon: Banana },
  { label: "150g batata doce", icon: Leaf },
  { label: "aveia", icon: Wheat },
  { label: "pasta de amendoim", icon: Package },
];

const filtros = [
  "Todos",
  "Low carb",
  "High protein",
  "Sem lactose",
  "Vegetariano",
  "Vegano",
  "Pré treino",
  "Pós treino",
];

function AlunoTrocas() {
  const { session } = useAlunoSession();
  const trocasIA = useServerFn(gerarTrocasIA);
  const nome = session?.nome ?? "Aluno";
  const initials = nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();

  const [filtro, setFiltro] = useState("Todos");
  const [pedido, setPedido] = useState("");
  const [loading, setLoading] = useState(false);
  const [resposta, setResposta] = useState<string | null>(null);
  const [respostaData, setRespostaData] = useState<RespostaIA | null>(null);
  const [historico, setHistorico] = useState<{ pedido: string; data: RespostaIA | null; resposta: string; quando: string }[]>([]);
  const [imagem, setImagem] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function escolherFoto() {
    fileRef.current?.click();
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("Selecione uma imagem.");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      toast.error("Imagem deve ter até 5MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImagem(reader.result as string);
    reader.readAsDataURL(f);
  }

  async function gerar(textoOverride?: string) {
    const texto = (textoOverride ?? pedido).trim();
    if (!texto && !imagem) {
      toast.error("Digite uma refeição ou anexe uma foto.");
      return;
    }
    setLoading(true);
    setResposta(null);
    setRespostaData(null);
    try {
      const result = await trocasIA({
        data: { pedido: texto, filtro, imagem: imagem ?? "" },
      });
      if (result?.error) throw new Error(result.error);
      const r = result?.resposta ?? "";
      const d = (result?.data ?? null) as RespostaIA | null;
      setResposta(r);
      setRespostaData(d);
      const titulo = texto || "Foto do prato";
      setHistorico((prev) => [
        { pedido: titulo, data: d, resposta: r, quando: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) },
        ...prev,
      ].slice(0, 5));
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao gerar substituições.");
    } finally {
      setLoading(false);
    }
  }

  function copiarResposta() {
    const txt = respostaData ? respostaToText(respostaData) : resposta;
    if (!txt) return;
    navigator.clipboard.writeText(txt);
    toast.success("Copiado!");
  }

  function compartilharWhats() {
    const txt = respostaData ? respostaToText(respostaData) : resposta;
    if (!txt) return;
    const url = `https://wa.me/?text=${encodeURIComponent(txt)}`;
    window.open(url, "_blank");
  }

  return (
    <div className="px-5 pt-4 pb-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between pt-2">
        <div className="min-w-0">
          <h1 className="text-[34px] leading-[1.05] font-black tracking-tight text-black">
            Trocas com IA
          </h1>
          <p className="mt-2 text-[14px] text-black/45 font-medium">
            Substituições inteligentes para sua dieta
          </p>
        </div>
        <ProfileAvatar />
      </div>

      {/* Search card */}
      <div className="rounded-3xl bg-white border-2 border-[#F70906]/15 shadow-[0_4px_20px_rgba(247,9,6,0.06)] p-3 space-y-2.5">
        <div className="flex items-start gap-2.5">
          <div className="h-9 w-9 shrink-0 rounded-xl bg-[#F70906]/10 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-[#F70906]" strokeWidth={2.4} />
          </div>
          <textarea
            value={pedido}
            onChange={(e) => setPedido(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                gerar();
              }
            }}
            rows={imagem ? 1 : 2}
            placeholder="Ex: 150g frango + 100g arroz + salada"
            className="flex-1 bg-transparent outline-none text-[14px] placeholder:text-black/35 font-medium text-black resize-none py-1.5"
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onFileChange}
          />
          <button
            onClick={escolherFoto}
            className="h-9 w-9 shrink-0 rounded-xl flex items-center justify-center text-black/40 hover:text-[#F70906] active:scale-95"
            title="Anexar foto do prato"
          >
            <Paperclip className="h-4 w-4" />
          </button>
        </div>
        {imagem && (
          <div className="relative inline-block">
            <img src={imagem} alt="Prato" className="h-20 w-20 rounded-xl object-cover border border-black/10" />
            <button
              onClick={() => setImagem(null)}
              className="absolute -top-1.5 -right-1.5 h-6 w-6 rounded-full bg-black text-white flex items-center justify-center shadow-md active:scale-90"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <button
          onClick={() => gerar()}
          disabled={loading}
          className="w-full h-12 rounded-2xl bg-[#F70906] text-white font-bold text-[14px] flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(247,9,6,0.3)] active:scale-[0.98] transition disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" strokeWidth={2.6} />}
          {loading ? "Gerando..." : "Gerar substituições"}
        </button>
      </div>

      {/* Sugestões rápidas */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-[16px] font-bold text-black">Sugestões rápidas</h2>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {sugestoes.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.label}
                onClick={() => {
                  setPedido(s.label);
                  gerar(s.label);
                }}
                className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-white border border-black/5 shadow-[0_2px_10px_rgba(0,0,0,0.03)] active:scale-[0.98] transition text-left"
              >
                <div className="h-9 w-9 shrink-0 rounded-xl bg-[#F70906]/8 flex items-center justify-center">
                  <Icon className="h-4 w-4 text-[#F70906]" strokeWidth={2.2} />
                </div>
                <span className="text-[12px] font-semibold text-black leading-tight">
                  {s.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filtros */}
      <div className="space-y-3">
        <h2 className="text-[16px] font-bold text-black px-1">Filtros</h2>
        <div className="flex flex-wrap gap-2">
          {filtros.map((f) => {
            const active = filtro === f;
            return (
              <button
                key={f}
                onClick={() => setFiltro(f)}
                className={`h-9 px-4 rounded-full text-[13px] font-semibold transition active:scale-95 ${
                  active
                    ? "bg-[#F70906] text-white shadow-[0_4px_12px_rgba(247,9,6,0.25)]"
                    : "bg-white text-black border border-black/10"
                }`}
              >
                {f}
              </button>
            );
          })}
        </div>
      </div>

      {/* Resposta da IA */}
      {(loading || respostaData || resposta) && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[16px] font-bold text-black">Resultado</h2>
          </div>
          <div className="rounded-3xl bg-white border border-black/5 shadow-[0_4px_20px_rgba(0,0,0,0.05)] overflow-hidden">
            <div className="p-3 space-y-3">
              {loading ? (
                <div className="flex items-center gap-2 text-black/50 text-[13px] p-2">
                  <Loader2 className="h-4 w-4 animate-spin text-[#F70906]" />
                  Buscando equivalências nas tabelas TACO, TBCA e USDA...
                </div>
              ) : respostaData ? (
                <>
                  {/* Referência */}
                  <div className="rounded-2xl p-3 bg-[#FEF2F2] ring-1 ring-[#FECACA]">
                    <div className="text-[10px] font-extrabold tracking-[0.18em] text-black/45">REFERÊNCIA</div>
                    <div className="mt-1 text-[15px] font-bold text-black leading-snug">
                      {respostaData.referencia.descricao}
                    </div>
                    <div className="mt-1.5 flex items-baseline gap-1">
                      <span className="text-[26px] font-extrabold text-[#F70906] tabular-nums leading-none">
                        {fmt(respostaData.referencia.kcal)}
                      </span>
                      <span className="text-[12px] text-black/45 font-medium">kcal</span>
                    </div>
                    <div className="mt-2">
                      <MacroPills item={respostaData.referencia} />
                    </div>
                  </div>

                  {respostaData.substituicoes.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-[10px] font-extrabold tracking-[0.18em] text-black/45 px-1">
                        SUBSTITUIÇÕES
                      </div>
                      <div className="space-y-2">
                        {respostaData.substituicoes.map((s, i) => {
                          const menos = s.kcal < respostaData.referencia.kcal * 0.85;
                          return <SubCard key={i} item={s} destaqueKcal={menos} />;
                        })}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-black">
                  {resposta}
                </pre>
              )}
            </div>
            {!loading && (respostaData || resposta) && (
              <div className="flex gap-2 px-3 py-2 border-t border-black/5">
                <button
                  onClick={copiarResposta}
                  className="w-full h-9 rounded-xl bg-black/5 text-black text-[12px] font-semibold active:scale-[0.98] transition"
                >
                  Copiar
                </button>
              </div>
            )}
            <div className="flex items-center gap-2 px-4 py-2.5 bg-black/[0.02] border-t border-black/5">
              <Info className="h-3.5 w-3.5 text-black/40" />
              <span className="text-[11px] text-black/50 font-medium">
                Fontes: TACO › TBCA › USDA › rótulo. Valores aproximados.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Histórico recente */}
      {historico.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-[16px] font-bold text-black px-1">Histórico recente</h2>
          <div className="flex gap-2 overflow-x-auto -mx-5 px-5 pb-1 scrollbar-none">
            {historico.map((h, i) => (
              <button
                key={i}
                onClick={() => {
                  setPedido(h.pedido);
                  setResposta(h.resposta);
                  setRespostaData(h.data);
                }}
                className="shrink-0 min-w-[200px] flex items-center gap-2.5 p-2.5 rounded-2xl bg-white border border-black/5 shadow-[0_2px_10px_rgba(0,0,0,0.03)] active:scale-[0.98] transition text-left"
              >
                <div className="h-9 w-9 shrink-0 rounded-xl bg-[#F70906]/8 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-[#F70906]" strokeWidth={2.2} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-bold text-black truncate">{h.pedido}</div>
                  <div className="text-[10px] text-black/45 font-medium mt-0.5">{h.quando}</div>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-[#F70906] shrink-0" strokeWidth={2.4} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* IA card */}
      <div className="rounded-3xl bg-[#F70906]/6 border border-[#F70906]/12 p-4 flex items-start gap-3">
        <div className="h-11 w-11 shrink-0 rounded-2xl bg-[#F70906]/12 flex items-center justify-center">
          <Sparkles className="h-5 w-5 text-[#F70906]" strokeWidth={2.4} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[14px] font-bold text-black leading-snug">
            IA treinada com TACO, TBCA e USDA.
          </h3>
          <p className="text-[12px] text-black/55 font-medium mt-1 leading-snug">
            Substituições com equivalência nutricional pelo macro predominante.
          </p>
        </div>
      </div>
    </div>
  );
}
