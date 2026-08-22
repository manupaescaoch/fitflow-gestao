export const TEST_PHONE_OVERRIDE = "5581995411196";

export function MSG_ANAMNESE_RECEBIDA(nome: string): string {
  const primeiro = (nome || "").trim().split(/\s+/)[0] || "";
  const saudacao = primeiro ? `Olá, ${primeiro}!` : `Olá!`;
  return `${saudacao} Tudo certo?

Recebi sua anamnese por aqui.

Agora vou analisar suas informações com calma para montar um planejamento alinhado com seu objetivo, rotina, preferências e nível atual.

O prazo para entrega do seu planejamento é de até 3 dias úteis.

Assim que estiver pronto, te aviso por aqui.`;
}

export const MSG_PRAZO_3_DIAS_UTEIS =
  "O prazo para entrega do seu planejamento é de até *3 dias úteis*.";

/** Check-in quinzenal (sem formulário/link). Placeholder: {nome}. */
export const MSG_CHECKIN_QUINZENAL_PADRAO = `Fala, {nome}! Tudo certo?

Passando pra saber como estão sendo esses dias:

- Como está a adesão ao treino?
- E à dieta, está conseguindo seguir?
- Tem aparecido alguma dificuldade ou dúvida?

Me conta por aqui mesmo, em texto ou áudio. Isso ajuda muito a gente a te acompanhar de perto até o feedback mensal.`;