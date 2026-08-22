interface Props {
  pago: boolean;
}

export function StatusBadge({ pago }: Props) {
  const label = pago ? "Pago" : "Pendente";
  const color = pago ? "var(--green)" : "var(--amber, #F59E0B)";
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ background: color + "1A", color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}