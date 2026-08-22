/** Lógica de horário do Agente de Dúvidas.
 *  Janela permitida: dias_semana (1=seg ... 7=dom) entre `hora_inicio` e
 *  `hora_fim` no fuso America/Sao_Paulo. */

export type AgenteJanela = {
  ativo: boolean;
  hora_inicio: number;
  hora_fim: number;
  dias_semana: number[];
};

/** Retorna { hora, diaSemana } no fuso America/Sao_Paulo (1=seg ... 7=dom). */
export function nowSaoPaulo(date: Date = new Date()): { hora: number; diaSemana: number } {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    hour: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const wdRaw = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const hourRaw = parts.find((p) => p.type === "hour")?.value ?? "0";
  const map: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  return { hora: Number(hourRaw) % 24, diaSemana: map[wdRaw] ?? 1 };
}

/** True se agora está dentro da janela permitida (ignora `ativo`). */
export function dentroDoHorario(j: AgenteJanela, date: Date = new Date()): boolean {
  const { hora, diaSemana } = nowSaoPaulo(date);
  if (!j.dias_semana.includes(diaSemana)) return false;
  return hora >= j.hora_inicio && hora < j.hora_fim;
}

export type StatusAgente = "ativo_agora" | "fora_horario" | "inativo";

export function statusAtual(j: AgenteJanela, date: Date = new Date()): StatusAgente {
  if (!j.ativo) return "inativo";
  return dentroDoHorario(j, date) ? "ativo_agora" : "fora_horario";
}

const NOMES_DIAS = ["", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
export function formatarDias(dias: number[]): string {
  const ord = [...dias].sort((a, b) => a - b);
  if (ord.join(",") === "1,2,3,4,5,6") return "Segunda a sábado";
  if (ord.join(",") === "1,2,3,4,5,6,7") return "Todos os dias";
  if (ord.join(",") === "1,2,3,4,5") return "Segunda a sexta";
  return ord.map((d) => NOMES_DIAS[d]).join(", ");
}

export function formatarFaixaHoras(hi: number, hf: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(hi)}h às ${pad(hf)}h`;
}