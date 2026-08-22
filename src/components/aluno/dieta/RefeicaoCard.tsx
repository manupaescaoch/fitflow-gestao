import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Sparkles, MoreVertical, Loader2, Sun, Moon, Coffee, UtensilsCrossed, Apple, Pencil, FileText, List, Check, X, GripVertical, ArrowUp, ArrowDown } from "lucide-react";
import type { DietaItem, RefeicaoCompleta, ItemSub } from "@/lib/dieta";
import { fmtMacro, somaRefeicao, parseRefeicaoObs, serializeRefeicaoObs } from "@/lib/dieta";
import { htmlToPlainText } from "@/lib/rich-html";
import { ItemAlimentoRow } from "./ItemAlimentoRow";
import { BuscaAlimento, type NovoItemComSubs } from "./BuscaAlimento";

export function RefeicaoCard({
  refeicao, canEdit, defaultOpen, busyIA,
  onUpdateRefeicao, onAddItem, onUpdateItem, onReplaceItem, onDeleteItem, onReorderItens, onDeleteRefeicao, onDuplicarRefeicao,
  onCompletarIA, onAlternativaIA, onSubstituirIA, lockTextoLivre, onEditarCompleto,
  onMoverCima, onMoverBaixo, podeSubir, podeDescer,
}: {
  refeicao: RefeicaoCompleta;
  canEdit: boolean;
  defaultOpen?: boolean;
  busyIA?: boolean;
  onUpdateRefeicao: (patch: { nome?: string; horario?: string | null; observacoes?: string | null }) => void;
  onAddItem: (
    item: Omit<DietaItem, "id" | "refeicao_id" | "criado_em" | "ordem">,
    substitutos?: Omit<ItemSub, "id" | "item_id" | "criado_em" | "ordem">[],
  ) => void;
  onUpdateItem: (itemId: string, patch: Partial<DietaItem>) => void;
  onReplaceItem?: (itemId: string, novo: NovoItemComSubs) => void;
  onDeleteItem: (itemId: string) => void;
  onReorderItens?: (novaOrdemIds: string[]) => void;
  onDeleteRefeicao: () => void;
  onDuplicarRefeicao?: () => void;
  onCompletarIA: () => void;
  onAlternativaIA: () => void;
  onSubstituirIA: () => void;
  lockTextoLivre?: boolean;
  /** Abre o modal completo de edição da refeição (com lista de alimentos). */
  onEditarCompleto?: () => void;
  onMoverCima?: () => void;
  onMoverBaixo?: () => void;
  podeSubir?: boolean;
  podeDescer?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const [menu, setMenu] = useState(false);
  const [iaMenu, setIaMenu] = useState(false);
  const [editHeader, setEditHeader] = useState(false);
  const [draftNome, setDraftNome] = useState(refeicao.nome);
  const [draftHorario, setDraftHorario] = useState(refeicao.horario ?? "");
  const ref = useRef<HTMLDivElement>(null);
  const iaRef = useRef<HTMLDivElement>(null);

  const parsed = useMemo(() => parseRefeicaoObs(refeicao.observacoes), [refeicao.observacoes]);
  const [modo, setModo] = useState<"estruturado" | "texto_livre">(lockTextoLivre ? "texto_livre" : parsed.modo);
  const [conteudoLivre, setConteudoLivre] = useState(htmlToPlainText(parsed.conteudo));
  const [obsLivre, setObsLivre] = useState(htmlToPlainText(parsed.observacao));

  useEffect(() => {
    setModo(lockTextoLivre ? "texto_livre" : parsed.modo);
    setConteudoLivre(htmlToPlainText(parsed.conteudo));
    setObsLivre(htmlToPlainText(parsed.observacao));
  }, [parsed.modo, parsed.conteudo, parsed.observacao, lockTextoLivre]);

  function persistTextoLivre(novoConteudo: string, novaObs: string) {
    onUpdateRefeicao({ observacoes: serializeRefeicaoObs("texto_livre", novoConteudo, novaObs) });
  }

  function alternarModo() {
    if (!canEdit) return;
    if (modo === "estruturado") {
      setModo("texto_livre");
      // Persiste imediatamente como texto livre vazio (preserva qualquer observação atual como observação)
      onUpdateRefeicao({ observacoes: serializeRefeicaoObs("texto_livre", conteudoLivre, obsLivre || parsed.observacao) });
    } else {
      setModo("estruturado");
      // Volta ao modo estruturado: observações volta a ser texto puro (preserva a observação digitada no modo livre)
      onUpdateRefeicao({ observacoes: serializeRefeicaoObs("estruturado", "", obsLivre) });
    }
  }

  useEffect(() => {
    function on(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenu(false);
      if (iaRef.current && !iaRef.current.contains(e.target as Node)) setIaMenu(false);
    }
    document.addEventListener("mousedown", on);
    return () => document.removeEventListener("mousedown", on);
  }, []);

  const macros = somaRefeicao(refeicao);
  const periodIcon = getPeriodIcon(refeicao.horario, refeicao.nome);
  const isLivre = modo === "texto_livre" || !!lockTextoLivre;

  function startEditHeader() {
    setDraftNome(refeicao.nome);
    setDraftHorario(refeicao.horario ?? "");
    setEditHeader(true);
  }
  function saveHeader() {
    const nome = draftNome.trim();
    const horario = draftHorario.trim() || null;
    const patch: { nome?: string; horario?: string | null } = {};
    if (nome && nome !== refeicao.nome) patch.nome = nome;
    if ((horario ?? null) !== (refeicao.horario ?? null)) patch.horario = horario;
    if (Object.keys(patch).length > 0) onUpdateRefeicao(patch);
    setEditHeader(false);
  }
  function cancelHeader() {
    setDraftNome(refeicao.nome);
    setDraftHorario(refeicao.horario ?? "");
    setEditHeader(false);
  }

  return (
    <div className="border-b border-slate-100 last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 py-3.5 px-4 hover:bg-slate-50/60 transition text-left"
      >
        <ChevronDown
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? "rotate-0" : "-rotate-90"}`}
        />
        <div className={`w-7 h-7 rounded-lg grid place-items-center shrink-0 ${periodIcon.bg}`}>
          <periodIcon.Icon className={`w-3.5 h-3.5 ${periodIcon.fg}`} />
        </div>
        {editHeader ? (
          <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
            <input
              autoFocus
              value={draftNome}
              onChange={(e) => setDraftNome(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); saveHeader(); }
                if (e.key === "Escape") { e.preventDefault(); cancelHeader(); }
              }}
              placeholder="Nome da refeição"
              className="text-[14px] font-semibold tracking-tight text-slate-900 px-2 py-1 rounded-md border border-slate-200 bg-white outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-500/10"
            />
            <input
              type="time"
              value={draftHorario}
              onChange={(e) => setDraftHorario(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); saveHeader(); }
                if (e.key === "Escape") { e.preventDefault(); cancelHeader(); }
              }}
              className="text-[12px] tabular-nums px-2 py-1 rounded-md border border-slate-200 bg-white outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-500/10"
            />
            <button
              onClick={saveHeader}
              className="p-1 rounded-md text-emerald-600 hover:bg-emerald-50 transition"
              title="Salvar"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={cancelHeader}
              className="p-1 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              title="Cancelar"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div
            className={`flex items-center gap-2 shrink-0 ${canEdit ? "group/header cursor-text" : ""}`}
            onClick={(e) => {
              if (!canEdit) return;
              e.stopPropagation();
              e.preventDefault();
              startEditHeader();
            }}
            title={canEdit ? "Clique para editar nome e horário" : undefined}
          >
            <span className="text-[14px] font-semibold tracking-tight text-slate-900 group-hover/header:underline decoration-dotted underline-offset-4">{refeicao.nome}</span>
            {refeicao.horario && (
              <span className="text-[11px] tabular-nums px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">
                {refeicao.horario}
              </span>
            )}
            {isLivre && (
              <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-semibold">
                texto livre
              </span>
            )}
          </div>
        )}

        <div className="flex-1" />

        <div className="hidden md:flex items-center gap-4 text-[12px] tabular-nums text-slate-500 shrink-0">
          {isLivre ? (
            <span className="italic text-slate-400">não contabilizado</span>
          ) : (
            <>
              <span>
                <span className="text-slate-400">🍽</span> {refeicao.itens.length} {refeicao.itens.length === 1 ? "alimento" : "alimentos"}
              </span>
              <span className="font-semibold text-slate-900">{fmtMacro(macros.kcal)} kcal</span>
            </>
          )}
        </div>

        {canEdit && (
          <div className="flex items-center gap-0.5 shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
            {onMoverCima && (
              <button
                onClick={onMoverCima}
                disabled={!podeSubir}
                className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                title="Mover para cima"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
            )}
            {onMoverBaixo && (
              <button
                onClick={onMoverBaixo}
                disabled={!podeDescer}
                className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                title="Mover para baixo"
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
            )}
            {!lockTextoLivre && (
              <button
                onClick={alternarModo}
                className={`p-1.5 rounded-md hover:bg-slate-100 transition ${isLivre ? "text-amber-600" : "text-slate-400 hover:text-slate-700"}`}
                title={isLivre ? "Voltar para modo estruturado" : "Mudar para texto livre"}
              >
                {isLivre ? <List className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
              </button>
            )}
            <button
              onClick={onEditarCompleto ?? startEditHeader}
              className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
              title={onEditarCompleto ? "Editar refeição" : "Editar nome e horário"}
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            {!lockTextoLivre && (
            <div className="relative" ref={iaRef}>
              <button
                onClick={() => setIaMenu((v) => !v)}
                disabled={busyIA || isLivre}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-rose-600 hover:bg-rose-50 disabled:opacity-50 transition"
              >
                {busyIA ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                IA
              </button>
              {iaMenu && (
                <div className="absolute right-0 top-full mt-1 w-52 rounded-xl bg-popover border border-border shadow-lg py-1 z-20">
                  <MenuItem label="Completar com IA" onClick={() => { setIaMenu(false); onCompletarIA(); }} />
                  <MenuItem label="Gerar alternativa" onClick={() => { setIaMenu(false); onAlternativaIA(); }} />
                  <MenuItem label="Substituir mantendo macros" onClick={() => { setIaMenu(false); onSubstituirIA(); }} />
                </div>
              )}
            </div>
            )}

            <div className="relative" ref={ref}>
              <button
                onClick={(e) => { e.stopPropagation(); setMenu((v) => !v); }}
                className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>
              {menu && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 bottom-full mb-1 w-44 rounded-xl bg-popover border border-border shadow-lg py-1 z-50"
                >
                  <MenuItem label="Editar" onClick={() => { setMenu(false); if (onEditarCompleto) onEditarCompleto(); else setOpen(true); }} />
                  {onMoverCima && (
                    <MenuItem
                      label="Mover para cima"
                      icon={<ArrowUp className="w-3.5 h-3.5" />}
                      disabled={!podeSubir}
                      onClick={() => { setMenu(false); onMoverCima(); }}
                    />
                  )}
                  {onMoverBaixo && (
                    <MenuItem
                      label="Mover para baixo"
                      icon={<ArrowDown className="w-3.5 h-3.5" />}
                      disabled={!podeDescer}
                      onClick={() => { setMenu(false); onMoverBaixo(); }}
                    />
                  )}
                  {onDuplicarRefeicao && (
                    <MenuItem label="Duplicar" onClick={() => { setMenu(false); onDuplicarRefeicao(); }} />
                  )}
                  <MenuItem label="Remover" tone="danger" onClick={() => { setMenu(false); onDeleteRefeicao(); }} />
                </div>
              )}
            </div>
          </div>
        )}
      </button>

      {open && (
        <div className="pl-14 pr-4 pb-4 space-y-2 animate-in fade-in slide-in-from-top-1 duration-150">
          {isLivre ? (
            <div className="space-y-3">
              <textarea
                value={conteudoLivre}
                onChange={(e) => setConteudoLivre(e.target.value)}
                onBlur={() => persistTextoLivre(conteudoLivre, obsLivre)}
                disabled={!canEdit}
                rows={Math.max(8, Math.min(24, conteudoLivre.split("\n").length + 2))}
                placeholder={`Opção 1:\nCuscuz de milho cozido — 50g\nOvo de galinha cozido — 2 unidades (100g)\nTotal: 304 kcal | 23.9g P / 32.7g C / 8.6g G\n\nOpção 2:\n…`}
                className="w-full text-[13px] leading-relaxed font-mono p-3 rounded-lg border border-slate-200 bg-white outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-500/10 transition resize-y"
              />
              <div>
                <label className="block text-[11px] uppercase tracking-wide text-slate-500 font-semibold mb-1">Observação</label>
                <textarea
                  value={obsLivre}
                  onChange={(e) => setObsLivre(e.target.value)}
                  onBlur={() => persistTextoLivre(conteudoLivre, obsLivre)}
                  disabled={!canEdit}
                  rows={2}
                  placeholder="Observações da refeição (opcional)…"
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white outline-none focus:border-rose-300 transition resize-y"
                />
              </div>
            </div>
          ) : (
            <>
          {canEdit && (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <BuscaAlimento onAdd={(it) => onAddItem(
                  {
                    alimento_id: it.alimento_id, nome_custom: it.nome_custom,
                    quantidade: it.quantidade, unidade: it.unidade,
                    kcal: it.kcal, ptn: it.ptn, cho: it.cho, lip: it.lip,
                  },
                  it.substitutos.map((s) => ({
                    alimento_id: s.alimento_id, nome_custom: s.nome_custom,
                    quantidade: s.quantidade, unidade: s.unidade,
                    kcal: s.kcal, ptn: s.ptn, cho: s.cho, lip: s.lip,
                  })),
                )} />
              </div>
              <button
                onClick={onCompletarIA}
                disabled={busyIA}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-rose-600 hover:bg-rose-50 disabled:opacity-50"
              >
                <Sparkles className="w-3 h-3" /> Completar IA
              </button>
            </div>
          )}

          {refeicao.itens.length === 0 ? (
            <div className="py-4 text-center text-xs text-muted-foreground">
              Refeição vazia · use a busca, adicione manualmente ou peça à IA.
            </div>
          ) : (
            <ItensDraggable
              itens={refeicao.itens}
              canEdit={canEdit}
              onUpdateItem={onUpdateItem}
              onDeleteItem={onDeleteItem}
              onReplaceItem={onReplaceItem}
              onReorder={onReorderItens}
            />
          )}

          {canEdit && (
            <div className="pt-2">
              <input
                defaultValue={refeicao.observacoes ?? ""}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v !== (refeicao.observacoes ?? "")) onUpdateRefeicao({ observacoes: v || null });
                }}
                placeholder="Observações da refeição…"
                className="w-full text-xs px-2 py-1.5 rounded-md bg-muted/30 border border-transparent focus:border-border focus:bg-background outline-none transition"
              />
            </div>
          )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MenuItem({ label, onClick, tone, icon, disabled }: { label: string; onClick: () => void; tone?: "danger"; icon?: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 ${disabled ? "opacity-40 cursor-not-allowed" : "hover:bg-muted/60"} ${tone === "danger" ? "text-rose-600 hover:bg-rose-50" : ""}`}
    >
      {icon}
      {label}
    </button>
  );
}

type ItemDC = RefeicaoCompleta["itens"][number];

function ItensDraggable({
  itens, canEdit, onUpdateItem, onDeleteItem, onReplaceItem, onReorder,
}: {
  itens: ItemDC[];
  canEdit: boolean;
  onUpdateItem: (itemId: string, patch: Partial<DietaItem>) => void;
  onDeleteItem: (itemId: string) => void;
  onReplaceItem?: (itemId: string, novo: NovoItemComSubs) => void;
  onReorder?: (novaOrdemIds: string[]) => void;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const canReorder = canEdit && !!onReorder && itens.length > 1;

  function handleDragStart(e: React.DragEvent, id: string) {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = "move";
    try { e.dataTransfer.setData("text/plain", id); } catch {}
  }
  function handleDragOver(e: React.DragEvent, id: string) {
    if (!draggingId || draggingId === id) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setOverId(id);
  }
  function handleDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    if (!draggingId || draggingId === targetId) {
      setDraggingId(null); setOverId(null); return;
    }
    const ids = itens.map((i) => i.id);
    const fromIdx = ids.indexOf(draggingId);
    const toIdx = ids.indexOf(targetId);
    if (fromIdx < 0 || toIdx < 0) {
      setDraggingId(null); setOverId(null); return;
    }
    const newIds = [...ids];
    newIds.splice(fromIdx, 1);
    newIds.splice(toIdx, 0, draggingId);
    setDraggingId(null); setOverId(null);
    onReorder?.(newIds);
  }
  function handleDragEnd() {
    setDraggingId(null); setOverId(null);
  }

  return (
    <div className="divide-y divide-border/60">
      {itens.map((it) => {
        const isDragging = draggingId === it.id;
        const isOver = overId === it.id && draggingId !== it.id;
        return (
          <div
            key={it.id}
            onDragOver={(e) => canReorder && handleDragOver(e, it.id)}
            onDrop={(e) => canReorder && handleDrop(e, it.id)}
            className={`flex items-stretch gap-1 transition-all ${
              isDragging ? "opacity-40" : ""
            } ${isOver ? "bg-rose-50/60 ring-1 ring-rose-200 rounded-lg" : ""}`}
          >
            {canReorder && (
              <div
                draggable
                onDragStart={(e) => handleDragStart(e, it.id)}
                onDragEnd={handleDragEnd}
                className="flex items-center px-1 cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 transition shrink-0"
                title="Arraste para reordenar"
                aria-label="Reordenar alimento"
              >
                <GripVertical className="w-3.5 h-3.5" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <ItemAlimentoRow
                item={it}
                canEdit={canEdit}
                onUpdate={(patch) => onUpdateItem(it.id, patch)}
                onDelete={() => onDeleteItem(it.id)}
                onReplace={onReplaceItem ? (novo) => onReplaceItem(it.id, novo) : undefined}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function getPeriodIcon(horario: string | null, nome: string) {
  const n = nome.toLowerCase();
  const h = horario ? parseInt(horario.split(":")[0], 10) : null;
  if (n.includes("café") || n.includes("cafe") || (h !== null && h < 9)) {
    return { Icon: Coffee, bg: "bg-amber-50", fg: "text-amber-600" };
  }
  if (n.includes("almoço") || n.includes("almoco") || (h !== null && h >= 11 && h <= 14)) {
    return { Icon: UtensilsCrossed, bg: "bg-orange-50", fg: "text-orange-600" };
  }
  if (n.includes("jantar") || n.includes("ceia") || (h !== null && h >= 19)) {
    return { Icon: Moon, bg: "bg-indigo-50", fg: "text-indigo-600" };
  }
  if (n.includes("lanche") || n.includes("pré") || n.includes("pós")) {
    return { Icon: Apple, bg: "bg-emerald-50", fg: "text-emerald-600" };
  }
  return { Icon: Sun, bg: "bg-slate-100", fg: "text-slate-500" };
}
