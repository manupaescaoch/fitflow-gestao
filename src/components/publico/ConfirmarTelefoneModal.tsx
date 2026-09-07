import { Loader2, Phone } from "lucide-react";
import { splitPhone } from "./PhoneDdiInput";

const RED = "var(--primary)";
const INK = "#0a0a0a";
const BORDER = "#e5e5e5";
const SURFACE = "#ffffff";
const MUTED = "#737373";

interface Props {
  open: boolean;
  /** Telefone completo (DDI + número, só dígitos), ex: "5581999999999" */
  telefone: string;
  /** Indica que o envio está em andamento (após confirmar). */
  enviando?: boolean;
  onConfirmar: () => void;
  onEditar: () => void;
}

export function ConfirmarTelefoneModal({ open, telefone, enviando, onConfirmar, onEditar }: Props) {
  if (!open) return null;
  const { ddi, numero } = splitPhone(telefone);
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4 px-safe"
      style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-md rounded-lg p-6 md:p-8"
        style={{ backgroundColor: SURFACE, border: `1px solid ${BORDER}` }}
      >
        <div className="flex items-center justify-center mb-5">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{ backgroundColor: "#fee2e2" }}
          >
            <Phone className="w-7 h-7" style={{ color: RED }} />
          </div>
        </div>
        <h2 className="text-xl font-bold text-center mb-2" style={{ color: INK }}>
          Confirme seu telefone antes de enviar
        </h2>
        <p
          className="text-2xl font-semibold text-center my-4 tracking-wide"
          style={{ color: INK }}
        >
          +{ddi} {numero || "—"}
        </p>
        <p className="text-sm text-center mb-6" style={{ color: MUTED }}>
          Esse número será usado para identificar seu cadastro e enviar seus retornos. Está correto?
        </p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onConfirmar}
            disabled={enviando}
            className="w-full py-3 rounded-md font-semibold text-white text-base flex items-center justify-center gap-2 disabled:opacity-70"
            style={{ backgroundColor: RED }}
          >
            {enviando ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Enviando…
              </>
            ) : (
              "Confirmar e enviar"
            )}
          </button>
          <button
            type="button"
            onClick={onEditar}
            disabled={enviando}
            className="w-full py-3 rounded-md font-semibold text-base disabled:opacity-70"
            style={{ backgroundColor: SURFACE, color: INK, border: `1px solid ${BORDER}` }}
          >
            Editar telefone
          </button>
        </div>
      </div>
    </div>
  );
}