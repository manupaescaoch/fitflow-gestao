/**
 * Normalização única de telefone BR.
 *
 * Espelha 1:1 a função SQL `public.normalizar_telefone_br` para que o match
 * client/servidor seja idêntico — independente de máscara, DDI 55 ou
 * presença/ausência do 9º dígito de celular.
 *
 * - `apenasDigitos`: tira tudo que não é número.
 * - `normalizarTelefoneBR`: forma canônica de 10 dígitos (DDD + 8). Use SEMPRE
 *   esta função para comparar dois telefones.
 * - `telefoneArmazenamento`: forma para gravar no banco — mantém o 9º dígito
 *   se vier informado e prefixa DDI 55 quando faltar. Não use para comparar.
 */

export function apenasDigitos(input: string | null | undefined): string {
  return (input ?? "").replace(/\D/g, "");
}

export function normalizarTelefoneBR(input: string | null | undefined): string {
  let d = apenasDigitos(input);
  if (d.length >= 12 && d.startsWith("55")) {
    d = d.slice(2);
  }
  if (d.length === 11 && d[2] === "9") {
    d = d.slice(0, 2) + d.slice(3);
  }
  return d;
}

/** True quando o telefone bate com a forma canônica de 10 dígitos. */
export function telefoneValido(input: string | null | undefined): boolean {
  const canonico = normalizarTelefoneBR(input);
  if (canonico.length === 10) return true;
  // Telefones internacionais (DDI + número): aceitamos de 11 a 15 dígitos.
  return canonico.length >= 11 && canonico.length <= 15;
}

/** Compara dois telefones usando a forma canônica. */
export function mesmosTelefones(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const na = normalizarTelefoneBR(a);
  return na.length >= 10 && na === normalizarTelefoneBR(b);
}

/**
 * Forma para armazenar no banco: mantém o 9º dígito quando informado e prefixa
 * DDI 55 caso o telefone tenha apenas DDD + número. Não use para comparação.
 */
export function telefoneArmazenamento(input: string | null | undefined): string {
  let d = apenasDigitos(input);
  // Só prefixa DDI 55 quando o formato é claramente brasileiro:
  // 10 dígitos (DDD + fixo) ou 11 com o 9º dígito de celular.
  if (d.length === 10 || (d.length === 11 && d[2] === "9")) {
    d = "55" + d;
  }
  return d;
}
