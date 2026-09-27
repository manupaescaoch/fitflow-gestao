/** Configuração de API de chat compatível com OpenAI; chave apenas no servidor. */
export function getAiConfig() {
  const key = process.env.AI_API_KEY || process.env.OPENAI_API_KEY;
  if (key) return {
    url: process.env.AI_CHAT_URL || "https://api.openai.com/v1/chat/completions",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    model: process.env.AI_MODEL || "gpt-4o",
  };

  // Compatibilidade com a instalação existente até a migração das credenciais.
  const legacy = process.env.LOVABLE_API_KEY;
  if (legacy) return {
    url: "https://ai.gateway.lovable.dev/v1/chat/completions",
    headers: { Authorization: `Bearer ${legacy}`, "Content-Type": "application/json" },
    model: "google/gemini-2.5-flash",
  };
  return null;
}
