import { useEffect, useRef, useState } from "react";
import { Bold, Italic, Underline, List, Eraser, Palette, Highlighter } from "lucide-react";
import { sanitizeRichHtml, normalizeRich } from "@/lib/rich-html";

type Size = "small" | "normal" | "large" | "title";

const SIZE_PX: Record<Size, string> = {
  small: "11px",
  normal: "14px",
  large: "18px",
  title: "22px",
};

const COLORS = ["#000000", "var(--primary)", "#16a34a", "#0EA5E9", "#7B5BFF", "#F59E0B", "#EC4899", "#64748b"];
const HIGHLIGHTS = ["#FEF08A", "#BBF7D0", "#BFDBFE", "#FBCFE8", "#FED7AA", "#E9D5FF", "transparent"];

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  minHeight = 120,
  maxHeight,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  maxHeight?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const lastValueRef = useRef<string>("");

  // Sync external value -> DOM (only when it actually differs)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const normalized = normalizeRich(value);
    if (normalized !== lastValueRef.current) {
      el.innerHTML = normalized;
      lastValueRef.current = normalized;
    }
  }, [value]);

  function emit() {
    const el = ref.current;
    if (!el) return;
    const html = sanitizeRichHtml(el.innerHTML);
    lastValueRef.current = html;
    onChange(html);
  }

  function exec(cmd: string, val?: string) {
    ref.current?.focus();
    document.execCommand(cmd, false, val);
    emit();
  }

  function applyColor(color: string) {
    ref.current?.focus();
    document.execCommand("foreColor", false, color);
    emit();
  }

  function applyHighlight(color: string) {
    ref.current?.focus();
    if (color === "transparent") {
      document.execCommand("hiliteColor", false, "transparent");
    } else {
      document.execCommand("hiliteColor", false, color);
    }
    emit();
  }

  function applySize(size: Size) {
    const px = SIZE_PX[size];
    ref.current?.focus();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      // Apply to whole content via execCommand fontSize then patched span
      document.execCommand("fontSize", false, "7");
      const fonts = ref.current?.querySelectorAll('font[size="7"]');
      fonts?.forEach((f) => {
        const span = document.createElement("span");
        span.setAttribute("style", `font-size: ${px}`);
        span.innerHTML = f.innerHTML;
        f.replaceWith(span);
      });
      emit();
      return;
    }
    const range = sel.getRangeAt(0);
    const span = document.createElement("span");
    span.setAttribute("style", `font-size: ${px}`);
    if (size === "title") span.style.fontWeight = "bold";
    try {
      span.appendChild(range.extractContents());
      range.insertNode(span);
      sel.removeAllRanges();
    } catch {
      // ignore
    }
    emit();
  }

  return (
    <div className="rounded-md border border-border bg-background flex flex-col">
      <div className="flex flex-wrap items-center gap-1 px-2 py-1.5 border-b border-border bg-background sticky top-0 z-20 shadow-sm">
        <ToolbarButton onClick={() => exec("bold")} title="Negrito">
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => exec("italic")} title="Itálico">
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => exec("underline")} title="Sublinhado">
          <Underline className="h-3.5 w-3.5" />
        </ToolbarButton>
        <div className="w-px h-5 bg-border mx-1" />
        <select
          onChange={(e) => {
            const v = e.target.value as Size;
            if (v) applySize(v);
            e.target.value = "";
          }}
          defaultValue=""
          className="text-xs px-2 py-1 rounded border border-border bg-background"
          title="Tamanho"
        >
          <option value="" disabled>Tamanho</option>
          <option value="small">Pequeno</option>
          <option value="normal">Normal</option>
          <option value="large">Grande</option>
          <option value="title">Título</option>
        </select>
        <div className="w-px h-5 bg-border mx-1" />
        <ColorPicker
          icon={<Palette className="h-3.5 w-3.5" />}
          title="Cor do texto"
          colors={COLORS}
          onSelect={applyColor}
        />
        <ColorPicker
          icon={<Highlighter className="h-3.5 w-3.5" />}
          title="Marca-texto"
          colors={HIGHLIGHTS}
          onSelect={applyHighlight}
        />
        <div className="w-px h-5 bg-border mx-1" />
        <ToolbarButton onClick={() => exec("insertUnorderedList")} title="Lista">
          <List className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => exec("removeFormat")} title="Limpar formatação">
          <Eraser className="h-3.5 w-3.5" />
        </ToolbarButton>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onBlur={emit}
        data-placeholder={placeholder}
        className="prose prose-sm max-w-none px-3 py-2 text-sm focus:outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground overflow-y-auto"
        style={{ minHeight, maxHeight }}
      />
    </div>
  );
}

function ToolbarButton({
  children, onClick, title,
}: { children: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={title}
      className="p-1.5 rounded hover:bg-muted text-foreground"
    >
      {children}
    </button>
  );
}

function ColorPicker({
  icon, title, colors, onSelect,
}: { icon: React.ReactNode; title: string; colors: string[]; onSelect: (c: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((v) => !v)}
        title={title}
        className="p-1.5 rounded hover:bg-muted text-foreground"
      >
        {icon}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-40 bg-background border border-border rounded-md shadow-lg p-1.5 grid grid-cols-4 gap-1">
            {colors.map((c) => (
              <button
                key={c}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onSelect(c); setOpen(false); }}
                className="h-5 w-5 rounded border border-border"
                style={{
                  background: c === "transparent"
                    ? "linear-gradient(135deg, transparent 45%, #ef4444 45%, #ef4444 55%, transparent 55%)"
                    : c,
                }}
                title={c}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}