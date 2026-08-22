/**
 * Modelo de PDF de Plano Alimentar — Manu Paes / MPTEAM
 * Estrutura extraída do MODELO_PDF.pdf (referência em src/assets/dieta/modelo-pdf-referencia.pdf).
 *
 * Use este arquivo como fonte única para geração de PDFs de dieta no padrão MP.
 */

export const NUTRICIONISTA = {
  nome: "Manu Paes",
  titulo: "Nutricionista",
  email: "manupaes@mpteambr.com",
  crn: "46753/P",
  telefone: "(81) 99541-1196",
  site: "www.mpteambr.com",
} as const;

export const PDF_HEADER = {
  titulo: "PLANO ALIMENTAR",
  campos: ["Paciente", "Data", "Dias"],
  resumoNutricional: ["Calorias (kcal)", "Proteína", "Carboidratos", "Gorduras"],
} as const;

/** Cada refeição tem N opções equivalentes (substitutos). */
export type RefeicaoModelo = {
  numero: number;
  titulo: string;        // "Refeição 1 • Horário"
  horario: string;       // "07:00"
  opcoes: OpcaoModelo[]; // tipicamente 3
};

export type OpcaoModelo = {
  rotulo: string;        // "Opção 1"
  alimentos: { nome: string; quantidade: string }[]; // "x — xg"
  totais: { kcal: number; ptn: number; cho: number; lip: number };
};

export const ORIENTACOES_GERAIS = [
  {
    titulo: "RECOMENDAÇÕES BÁSICAS",
    tipo: "paragrafo" as const,
    conteudo:
      "Antes de pensar em suplemento, treino avançado ou estratégia mirabolante, domine o básico. Resultado não vem de mágica — vem de rotina bem feita.",
  },
  {
    titulo: "CARDIO",
    tipo: "paragrafo" as const,
    conteudo:
      "Cardio é obrigação. Não é “se der tempo”, nem “quando estiver motivado”. Faça de 5 a 7 vezes por semana, por pelo menos 30 minutos por dia: caminhada, trote, corrida leve, bicicleta, escada ou corda. O melhor cardio é aquele que você consegue manter na rotina. Resultado não vem do cardio perfeito — vem do cardio feito com constância.",
  },
  {
    titulo: "ÁGUA",
    tipo: "paragrafo_com_exemplo" as const,
    conteudo:
      "Água não é detalhe. A recomendação base é 35 ml por kg de peso corporal. Tenha uma garrafa por perto e não dependa da sede para lembrar de beber — quando ela chega, você já está atrasado.",
    exemplo: "60 kg ≈ 2,1 L/dia  •  100 kg ≈ 3,5 L/dia",
  },
  {
    titulo: "MUSCULAÇÃO",
    tipo: "paragrafo" as const,
    conteudo:
      "A prioridade do processo é a musculação. Treine de 4 a 5 vezes por semana e leve o treino a sério: carga progressiva, boa execução e consistência. Não adianta treinar “mais ou menos” e esperar resultado acima da média.",
  },
  {
    titulo: "DICAS ESSENCIAIS",
    tipo: "lista" as const,
    itens: [
      "Refrigerante zero, suco zero e gelatina zero estão liberados.",
      "Use pouco óleo vegetal no preparo dos alimentos.",
      "Tempere saladas com sal, limão ou vinagre. Se quiser, finalize com um fio de azeite extra virgem.",
      "Condimentos e temperos naturais liberados: curry, orégano, alho, cebola, salsinha, páprica, pimenta e similares.",
      "Prefira legumes de cor verde-escura.",
      "Use sal com moderação no preparo dos alimentos.",
      "Pese os alimentos já prontos — evita erro nas porções e deixa o plano mais preciso.",
      "Faça todas as refeições do dia. Se perder alguma, organize com o suporte para ajustar — não transforme um erro pequeno em bagunça completa.",
    ],
  },
  {
    titulo: "MARCAS DE SUPLEMENTOS",
    tipo: "paragrafo_com_exemplo" as const,
    conteudo:
      "Boas opções: **FORCE LABZ**, Dux, Shark Pro, Max Titanium, Integralmédica, Growth, Probiótica, New Millen, Redlion, FTW, New Nutrition e Adaptogen.",
    exemplo: "https://www.forcelabz.com/ — USE O CUPOM **MANU PAES**",
  },
  {
    titulo: "REFEIÇÃO LIVRE",
    tipo: "paragrafo" as const,
    conteudo:
      "Refeição livre existe para tornar o processo sustentável — mas livre não significa sem controle. É uma ferramenta, não autorização para virar trator em cima da comida. Dieta boa não é a que você faz perfeito por 7 dias; é a que você sustenta por meses.",
  },
  {
    titulo: "REFEIÇÃO LIVRE — COMO USAR",
    tipo: "lista" as const,
    itens: [
      "Frequência: 1 vez por semana.",
      "Quantidade: até 2 refeições no mesmo dia (ex.: almoço em família + jantar com amigos).",
      "Não transforme refeição livre em dia livre.",
      "Não compense no dia seguinte com jejum maluco ou restrição extrema.",
      "Evite alimentos que causam desconforto, alergia ou te deixam mal.",
      "Cuidado com álcool em excesso — atrapalha sono, recuperação, retenção e desempenho.",
      "Planeje antes, escolha algo que valha a pena, coma devagar e observe a saciedade.",
      "Você controla a refeição livre — ela não controla você.",
    ],
  },
  {
    titulo: "SUPLEMENTOS BÁSICOS",
    tipo: "paragrafo" as const,
    conteudo:
      "Suplemento não substitui dieta, treino e sono — mas pode ajudar quando o básico já está sendo feito. A ideia é fortalecer saúde, imunidade, recuperação e desempenho. Todos os itens abaixo: 1 vez ao dia, junto da primeira refeição.",
  },
  {
    titulo: "PROTOCOLO DE SUPLEMENTOS",
    tipo: "lista" as const,
    itens: [
      "Ômega 3 1000 mg — saúde cardiovascular, função cerebral, controle inflamatório, recuperação muscular e equilíbrio hormonal.",
      "NAC 600 mg — produção de glutationa, proteção hepática, imunidade e controle do estresse oxidativo.",
      "Multivitamínico — cobre possíveis deficiências de vitaminas e minerais; corpo deficiente não performa bem.",
      "Vitamina D 2000 UI — saúde óssea, imunidade, equilíbrio hormonal e força muscular.",
      "Complexo B — metabolismo energético, disposição e recuperação.",
      "Coenzima Q10 — produção de energia mitocondrial, disposição, desempenho e saúde cardiovascular.",
      "Indicação: gfarma.com.br — cupom MANUPAES.",
    ],
  },
  {
    titulo: "HIGIENE DO SONO",
    tipo: "paragrafo" as const,
    conteudo:
      "Sono não é luxo, é parte do resultado. Uma noite ruim afeta recuperação, fome, disposição, treino, humor e composição corporal. Você pode treinar bem e comer certo, mas se dorme mal todo dia está sabotando o processo.",
  },
  {
    titulo: "RITUAL DE SONO",
    tipo: "lista" as const,
    itens: [
      "Use chás relaxantes (passiflora, mulungu, melissa) cerca de 30 min antes de dormir. Evite chás com cafeína.",
      "Aromatize o ambiente com lavanda ou laranja doce (difusor ou vela segura).",
      "Evite estimulantes após as 18h: café, chá-preto, refrigerantes com cafeína, nicotina e pré-treinos.",
      "Crie um ritual de relaxamento: leitura leve, respiração ou meditação — repita todos os dias.",
      "Evite cochilos longos; se precisar, limite a 20–30 min no início da tarde.",
      "Reduza luz azul à noite (filtro no celular, menos tela).",
      "Diminua luzes fortes à noite — prefira luz baixa, indireta e amarelada.",
      "Refeições mais leves à noite e última refeição pelo menos 2h antes de deitar.",
      "Quarto escuro, silencioso e fresco. Horário regular para dormir e acordar. Cama é para descanso.",
    ],
  },
  {
    titulo: "CONSIDERAÇÃO FINAL",
    tipo: "paragrafo" as const,
    conteudo:
      "O básico funciona: cardio, água, treino, dieta, sono e consistência. Parece simples porque é simples — mas simples não significa fácil. Quem domina o básico por tempo suficiente chega no resultado que a maioria fica procurando em atalhos. Faça o combinado, siga o plano, ajuste quando precisar e continue. Resultado é consequência.",
  },
] as const satisfies readonly BlocoOrientacao[];

/** Tipos discriminados por estilo de renderização no PDF. */
export type BlocoOrientacao =
  | { titulo: string; tipo: "paragrafo"; conteudo: string }
  | { titulo: string; tipo: "paragrafo_com_exemplo"; conteudo: string; exemplo: string }
  | { titulo: string; tipo: "lista"; itens: readonly string[] };

export const RODAPE_CUPOM = {
  texto: "Mantenha o foco e os resultados virão!",
  link: "https://www.forcelabz.com/",
  cupom: "MANU PAES",
  assinatura: "Manu Paes\nNutricionista — CRN 46753/P",
} as const;

/** Formata linha de totais de uma opção: "350 kcal | 25,0g P / 40,0g C / 8,0g G" */
export function fmtTotaisOpcao(t: OpcaoModelo["totais"]): string {
  const f = (n: number) => n.toFixed(1).replace(".", ",");
  return `${Math.round(t.kcal)} kcal | ${f(t.ptn)}g P / ${f(t.cho)}g C / ${f(t.lip)}g G`;
}

/** Formata linha de alimento: "Pão integral — 60g" */
export function fmtAlimento(nome: string, quantidade: string): string {
  return `${nome} — ${quantidade}`;
}
