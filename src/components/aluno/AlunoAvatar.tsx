import { useMemo } from "react";
import { useSignedPhotoUrl, type FotoContext } from "@/lib/use-signed-photo-url";

function initials(nome: string) {
  const parts = (nome || "").trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}

export function AlunoAvatar({
  nome,
  fotoUrl,
  className = "",
  textClassName = "",
  context = "avatar",
}: {
  nome: string;
  fotoUrl?: string | null;
  className?: string;
  textClassName?: string;
  context?: FotoContext;
}) {
  const ini = useMemo(() => initials(nome), [nome]);
  const signed = useSignedPhotoUrl(fotoUrl, context);
  if (signed) {
    return (
      <div
        className={`rounded-full overflow-hidden bg-primary/10 ring-1 ring-primary/20 shrink-0 ${className}`}
      >
        <img src={signed} alt={nome} className="h-full w-full object-cover" />
      </div>
    );
  }
  return (
    <div
      className={`rounded-full bg-primary/10 ring-1 ring-primary/20 text-primary font-semibold flex items-center justify-center shrink-0 ${className} ${textClassName}`}
    >
      {ini}
    </div>
  );
}
