interface Props {
  tipo: string;
  valor: number;
}

export function TipoBadge({ tipo, valor }: Props) {
  const t = tipo?.toLowerCase();
  let label = "Receita";
  let color = "var(--green)";
  if (t === "estorno") {
    label = "Estorno";
    color = "var(--red)";
  } else if (t === "ajuste") {
    label = "Ajuste";
    color = "var(--blue)";
  } else if (valor < 0) {
    label = "Despesa";
    color = "var(--red)";
  }
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ background: color + "1A", color }}
    >
      {label}
    </span>
  );
}