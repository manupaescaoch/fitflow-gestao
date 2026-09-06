export type TipoCampo =
  | "texto_curto" | "texto_longo" | "numero" | "email" | "telefone"
  | "data" | "hora" | "multipla_escolha" | "caixas" | "lista"
  | "escala" | "estrelas" | "nps" | "sim_nao" | "arquivo"
  | "assinatura" | "texto_info" | "titulo_secao" | "separador";

export const TIPOS: { value: TipoCampo; label: string; grupo: string }[] = [
  { value: "texto_curto", label: "Resposta curta", grupo: "Texto" },
  { value: "texto_longo", label: "Resposta longa", grupo: "Texto" },
  { value: "numero", label: "Número", grupo: "Texto" },
  { value: "email", label: "E-mail", grupo: "Texto" },
  { value: "telefone", label: "Telefone", grupo: "Texto" },
  { value: "data", label: "Data", grupo: "Data e hora" },
  { value: "hora", label: "Horário", grupo: "Data e hora" },
  { value: "multipla_escolha", label: "Múltipla escolha", grupo: "Escolha" },
  { value: "caixas", label: "Caixas de seleção", grupo: "Escolha" },
  { value: "lista", label: "Lista suspensa", grupo: "Escolha" },
  { value: "sim_nao", label: "Sim ou não", grupo: "Escolha" },
  { value: "escala", label: "Escala numérica", grupo: "Avaliação" },
  { value: "estrelas", label: "Avaliação por estrelas", grupo: "Avaliação" },
  { value: "nps", label: "Nota de 0 a 10", grupo: "Avaliação" },
  { value: "arquivo", label: "Upload de arquivo", grupo: "Outros" },
  { value: "assinatura", label: "Assinatura", grupo: "Outros" },
  { value: "texto_info", label: "Texto informativo", grupo: "Layout" },
  { value: "titulo_secao", label: "Título de seção", grupo: "Layout" },
  { value: "separador", label: "Separador", grupo: "Layout" },
];

export const TIPOS_ESTATICOS: TipoCampo[] = ["texto_info", "titulo_secao", "separador"];
export const TIPOS_OPCOES: TipoCampo[] = ["multipla_escolha", "caixas", "lista"];

export type Operador = "igual" | "diferente" | "contem" | "maior" | "menor";

export const OPERADORES: { value: Operador; label: string }[] = [
  { value: "igual", label: "é igual a" },
  { value: "diferente", label: "é diferente de" },
  { value: "contem", label: "contém" },
  { value: "maior", label: "é maior que" },
  { value: "menor", label: "é menor que" },
];

export interface Regra { perguntaId: string; op: Operador; valor: string }
export interface Condicoes {
  modo?: "sempre" | "se";
  logica?: "E" | "OU";
  regras?: Regra[];
  obrigatoriaSeCondicao?: boolean;
}

export interface PerguntaConfig {
  min?: number | null;
  max?: number | null;
  minCaracteres?: number | null;
  maxCaracteres?: number | null;
  permitirOutro?: boolean;
  multiplos?: boolean;
  escalaMin?: number;
  escalaMax?: number;
  rotuloMin?: string;
  rotuloMax?: string;
  placeholder?: string;
}

export interface Pergunta {
  id: string;
  formulario_id: string;
  secao_id: string | null;
  ordem: number;
  tipo: TipoCampo;
  titulo: string;
  descricao: string | null;
  obrigatoria: boolean;
  opcoes: { id: string; label: string }[];
  config: PerguntaConfig;
  condicoes: Condicoes;
  excluido_em?: string | null;
}

export type DestinoSecao = "proxima" | "encerrar" | "secao";

export interface Secao {
  id: string;
  formulario_id: string;
  ordem: number;
  titulo: string;
  descricao: string | null;
  destino: DestinoSecao;
  destino_secao_id: string | null;
  excluido_em?: string | null;
}

export interface FormConfig {
  aceitar_respostas?: boolean;
  exigir_identificacao?: boolean;
  permitir_anonimo?: boolean;
  coletar_nome?: boolean;
  coletar_email?: boolean;
  coletar_telefone?: boolean;
  uma_resposta_por_pessoa?: boolean;
  permitir_editar?: boolean;
  barra_progresso?: boolean;
  embaralhar_perguntas?: boolean;
  embaralhar_alternativas?: boolean;
  enviar_copia?: boolean;
  gerar_protocolo?: boolean;
  setor?: string;
}

export type StatusFormulario = "rascunho" | "publicado" | "pausado" | "encerrado" | "arquivado";

export interface Formulario {
  id: string;
  slug: string;
  titulo: string;
  descricao: string | null;
  capa_url: string | null;
  cor_primaria: string;
  status: StatusFormulario;
  autor_id: string | null;
  autor_nome: string | null;
  responsavel_id: string | null;
  abre_em: string | null;
  encerra_em: string | null;
  mensagem_sucesso: string;
  redirect_url: string | null;
  config: FormConfig;
  max_respostas: number | null;
  total_respostas: number;
  ultima_resposta_em: string | null;
  publicado_em: string | null;
  excluido_em: string | null;
  criado_em: string;
  atualizado_em: string;
}

export const STATUS_LABEL: Record<StatusFormulario, string> = {
  rascunho: "Rascunho",
  publicado: "Publicado",
  pausado: "Pausado",
  encerrado: "Encerrado",
  arquivado: "Arquivado",
};

export const STATUS_CLASS: Record<StatusFormulario, string> = {
  rascunho: "bg-muted text-muted-foreground",
  publicado: "bg-emerald-50 text-emerald-700",
  pausado: "bg-amber-50 text-amber-700",
  encerrado: "bg-slate-100 text-slate-600",
  arquivado: "bg-slate-100 text-slate-500",
};

export type Valores = Record<string, unknown>;

function comoTexto(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "boolean") return v ? "sim" : "nao";
  return String(v);
}

function comoNumero(v: unknown): number | null {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return Number.isFinite(n) ? n : null;
}

function normal(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

export function avaliarRegra(regra: Regra, valores: Valores): boolean {
  const bruto = valores[regra.perguntaId];
  const txt = normal(comoTexto(bruto));
  const alvo = normal(regra.valor ?? "");
  switch (regra.op) {
    case "igual":
      return Array.isArray(bruto) ? bruto.some((x) => normal(String(x)) === alvo) : txt === alvo;
    case "diferente":
      return Array.isArray(bruto) ? !bruto.some((x) => normal(String(x)) === alvo) : txt !== alvo;
    case "contem":
      return txt.includes(alvo);
    case "maior": {
      const a = comoNumero(bruto); const b = Number(regra.valor);
      return a !== null && Number.isFinite(b) && a > b;
    }
    case "menor": {
      const a = comoNumero(bruto); const b = Number(regra.valor);
      return a !== null && Number.isFinite(b) && a < b;
    }
    default:
      return true;
  }
}

export function condicoesAtendidas(cond: Condicoes | null | undefined, valores: Valores): boolean {
  if (!cond || cond.modo !== "se" || !cond.regras?.length) return true;
  const res = cond.regras.map((r) => avaliarRegra(r, valores));
  return cond.logica === "OU" ? res.some(Boolean) : res.every(Boolean);
}

export function perguntaVisivel(p: Pergunta, valores: Valores): boolean {
  return condicoesAtendidas(p.condicoes, valores);
}

export function perguntaObrigatoria(p: Pergunta, valores: Valores): boolean {
  if (p.condicoes?.obrigatoriaSeCondicao) {
    return condicoesAtendidas(p.condicoes, valores);
  }
  return p.obrigatoria;
}

export function respostaVazia(p: Pergunta, valor: unknown): boolean {
  if (valor === null || valor === undefined || valor === "") return true;
  if (Array.isArray(valor)) return valor.length === 0;
  return false;
}

export function validarPergunta(p: Pergunta, valor: unknown, valores: Valores): string | null {
  if (!perguntaVisivel(p, valores) || TIPOS_ESTATICOS.includes(p.tipo)) return null;
  const vazio = respostaVazia(p, valor);
  if (perguntaObrigatoria(p, valores) && vazio) return "Esta pergunta é obrigatória.";
  if (vazio) return null;
  const cfg = p.config ?? {};
  if (p.tipo === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(valor))) return "Informe um e-mail válido.";
  if (p.tipo === "telefone" && String(valor).replace(/\D/g, "").length < 10) return "Informe um telefone válido com DDD.";
  if (p.tipo === "numero") {
    const n = Number(valor);
    if (!Number.isFinite(n)) return "Informe um número válido.";
    if (cfg.min != null && n < cfg.min) return `O valor mínimo é ${cfg.min}.`;
    if (cfg.max != null && n > cfg.max) return `O valor máximo é ${cfg.max}.`;
  }
  if ((p.tipo === "texto_curto" || p.tipo === "texto_longo")) {
    const len = String(valor).trim().length;
    if (cfg.minCaracteres != null && len < cfg.minCaracteres) return `Mínimo de ${cfg.minCaracteres} caracteres.`;
    if (cfg.maxCaracteres != null && len > cfg.maxCaracteres) return `Máximo de ${cfg.maxCaracteres} caracteres.`;
  }
  if (p.tipo === "caixas" && Array.isArray(valor)) {
    if (cfg.min != null && valor.length < cfg.min) return `Selecione ao menos ${cfg.min} opção(ões).`;
    if (cfg.max != null && valor.length > cfg.max) return `Selecione no máximo ${cfg.max} opção(ões).`;
  }
  return null;
}

/** Problemas de lógica que impedem a publicação. */
export function validarLogica(secoes: Secao[], perguntas: Pergunta[]): string[] {
  const erros: string[] = [];
  const idsSecoes = new Set(secoes.map((s) => s.id));
  const ordemSecao = new Map(secoes.map((s, i) => [s.id, i]));
  const ativas = perguntas.filter((p) => !p.excluido_em);
  if (!ativas.length) erros.push("O formulário não possui perguntas.");
  const posPergunta = new Map(ativas.map((p, i) => [p.id, i]));

  for (const s of secoes) {
    if (s.destino === "secao") {
      if (!s.destino_secao_id || !idsSecoes.has(s.destino_secao_id)) {
        erros.push(`A seção "${s.titulo}" aponta para uma seção que não existe.`);
      } else if ((ordemSecao.get(s.destino_secao_id) ?? 0) <= (ordemSecao.get(s.id) ?? 0)) {
        erros.push(`A seção "${s.titulo}" cria um ciclo ao voltar para uma seção anterior.`);
      }
    }
  }
  for (const p of ativas) {
    for (const r of p.condicoes?.regras ?? []) {
      if (!r.perguntaId || !posPergunta.has(r.perguntaId)) {
        erros.push(`A pergunta "${p.titulo}" usa uma condição de uma pergunta que não existe mais.`);
        continue;
      }
      if ((posPergunta.get(r.perguntaId) ?? 0) >= (posPergunta.get(p.id) ?? 0)) {
        erros.push(`A pergunta "${p.titulo}" depende de uma resposta que vem depois dela.`);
      }
      if (!String(r.valor ?? "").trim()) {
        erros.push(`A pergunta "${p.titulo}" tem uma condição sem valor de comparação.`);
      }
    }
    if (TIPOS_OPCOES.includes(p.tipo) && !(p.opcoes ?? []).length) {
      erros.push(`A pergunta "${p.titulo}" não tem alternativas.`);
    }
  }
  return [...new Set(erros)];
}

export function novoId() {
  return crypto.randomUUID();
}

export function linkPublico(slug: string) {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  return `${base}/f/${slug}`;
}

export function mapFormulario(row: Record<string, unknown>): Formulario {
  return {
    ...(row as unknown as Formulario),
    config: (row["config"] as FormConfig) ?? {},
  };
}

export function mapPergunta(row: Record<string, unknown>): Pergunta {
  return {
    ...(row as unknown as Pergunta),
    opcoes: Array.isArray(row["opcoes"]) ? (row["opcoes"] as Pergunta["opcoes"]) : [],
    config: (row["config"] as PerguntaConfig) ?? {},
    condicoes: (row["condicoes"] as Condicoes) ?? {},
  };
}
