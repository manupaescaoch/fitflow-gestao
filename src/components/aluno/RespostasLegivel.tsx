import { useSignedAnamneseUrls } from "@/lib/use-signed-anamnese-urls";

function FotoSlot({ url, label }: { url: string; label: string }) {
  const { resolve } = useSignedAnamneseUrls([url]);
  const finalUrl = resolve(url);
  return (
    <div className="text-center">
      {finalUrl ? (
        <a href={finalUrl} target="_blank" rel="noreferrer">
          <img src={finalUrl} alt={label} className="w-full rounded border border-border object-cover" style={{ aspectRatio: "3/4" }} />
        </a>
      ) : (
        <div className="w-full rounded border border-dashed border-border flex items-center justify-center text-[11px] text-muted-foreground" style={{ aspectRatio: "3/4" }}>—</div>
      )}
      <div className="text-[11px] mt-1 text-muted-foreground">{label}</div>
    </div>
  );
}

export const FB_QUINZENAL_LABELS: Record<string, { titulo: string; campos: Record<string, string> }> = {
  identificacao: { titulo: "Identificação", campos: { nome: "Nome", nome_completo: "Nome", telefone: "Telefone", confirmar_telefone: "Confirmar telefone", peso_atual_kg: "Peso atual (kg)" } },
  evolucao: { titulo: "Como você tá evoluindo?", campos: { mudancas_espelho: "Mudanças no espelho", mudancas_fisico: "Mudanças no físico", espelho: "Espelho", sentimento: "Como tem se sentido", comentarios_externos: "Comentários externos", foco_4_semanas: "Foco 4 semanas" } },
  foco_4_semanas: { titulo: "Foco 4 semanas", campos: { foco: "Foco" } },
  treino: { titulo: "Treino", campos: { adesao_treino: "Adesão (estrelas)", adesao: "Adesão", dificuldades: "Dificuldades", sentimento_geral: "Como se sente", sentimento: "Como se sente" } },
  dieta: { titulo: "Dieta", campos: { adesao_dieta: "Adesão (estrelas)", adesao: "Adesão", finais_de_semana: "Finais de semana", sentimento_geral: "Como se sente", sentimento: "Como se sente" } },
  qualidade_vida: { titulo: "Quase lá", campos: { sono: "Sono (estrelas)", hidratacao: "Hidratação (estrelas)", intestino_ok: "Intestino funciona bem" } },
  recuperacao: { titulo: "Recuperação", campos: { sono: "Sono", agua: "Água", intestino: "Intestino" } },
};

export const FB_MENSAL_LABELS: Record<string, { titulo: string; campos: Record<string, string> }> = {
  identificacao: { titulo: "Identificação", campos: { nome: "Nome", nome_completo: "Nome", telefone: "Telefone", peso_atual_kg: "Peso atual (kg)" } },
  evolucao: { titulo: "Como você tá evoluindo?", campos: { mudancas_fisico: "Mudanças no físico", comentarios_externos: "Comentários externos", foco_4_semanas: "Foco 4 semanas", sentimento: "Como tem se sentido", espelho: "Espelho" } },
  foco_4_semanas: { titulo: "Foco 4 semanas", campos: { foco: "Foco" } },
  treino: { titulo: "Treino", campos: { adesao_estrelas: "Adesão (estrelas)", adesao: "Adesão", dificuldades: "Dificuldades", sentimento_geral: "Como se sente", sentimento: "Como se sente" } },
  dieta: { titulo: "Dieta", campos: { adesao_estrelas: "Adesão (estrelas)", adesao: "Adesão", tres_maiores_dificuldades: "3 maiores dificuldades", dificuldades_3: "3 maiores dificuldades", novos_habitos: "Novos hábitos", manter: "Manter", ajustar: "Ajustar", finais_de_semana: "Finais de semana", sentimento_geral: "Como se sente", sentimento: "Como se sente" } },
  qualidade_vida: { titulo: "Qualidade de vida", campos: { sono_estrelas: "Sono (estrelas)", hidratacao_estrelas: "Hidratação (estrelas)", intestino_funciona_bem: "Intestino funciona bem" } },
  recuperacao: { titulo: "Recuperação", campos: { sono: "Sono", descanso: "Descanso ao acordar", agua: "Água", intestino: "Intestino" } },
};

function isUrl(v: unknown): v is string {
  return typeof v === "string" && /^https?:\/\//i.test(v.trim());
}

function humanizeKey(k: string) {
  return k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatFieldValue(fk: string, v: any): React.ReactNode {
  if (v === null || v === undefined || v === "") return null;
  const STAR_KEYS = new Set(["adesao_treino", "adesao_dieta", "sono", "hidratacao"]);
  const isEstrelas = fk.endsWith("_estrelas") || (STAR_KEYS.has(fk) && typeof v === "number");
  if (isEstrelas && typeof v === "number" && v >= 1 && v <= 5) {
    return (
      <span className="text-sm">
        <span style={{ color: "#f50000" }}>{"★".repeat(v)}</span>
        <span className="text-muted-foreground">{"★".repeat(5 - v)}</span>
        <span className="ml-1.5 text-xs text-muted-foreground">({v}/5)</span>
      </span>
    );
  }
  if (fk === "intestino_funciona_bem" || fk === "intestino_ok") {
    if (v === "sim") return <span className="text-sm font-medium">Sim</span>;
    if (v === "nao") return <span className="text-sm font-medium">Não</span>;
  }
  if (typeof v === "number") return <span className="text-sm">{v}</span>;
  return <span className="text-sm whitespace-pre-wrap">{String(v)}</span>;
}

function RenderValor({ valor }: { valor: any }) {
  if (valor === null || valor === undefined || valor === "") return <span className="text-muted-foreground">—</span>;
  if (isUrl(valor)) {
    return <a href={valor} target="_blank" rel="noreferrer" className="text-primary text-sm underline break-all">{valor}</a>;
  }
  if (Array.isArray(valor)) {
    if (valor.length === 0) return <span className="text-muted-foreground">—</span>;
    return (
      <ul className="list-disc ml-5 text-sm space-y-0.5">
        {valor.map((v, i) => (
          <li key={i}>{typeof v === "object" ? JSON.stringify(v) : String(v)}</li>
        ))}
      </ul>
    );
  }
  if (typeof valor === "object") {
    return (
      <dl className="space-y-1 mt-1">
        {Object.entries(valor).map(([k, v]) => (
          <div key={k}>
            <dt className="text-[11px] font-medium text-muted-foreground">{humanizeKey(k)}</dt>
            <dd className="text-sm whitespace-pre-wrap"><RenderValor valor={v} /></dd>
          </div>
        ))}
      </dl>
    );
  }
  return <span className="text-sm whitespace-pre-wrap">{String(valor)}</span>;
}

export function RespostasLegivel({ tipo, dados }: { tipo: string; dados: any }) {
  const isObj = dados && typeof dados === "object" && !Array.isArray(dados);
  if (tipo === "anamnese" && isObj) {
    return <AnamneseRender dados={dados} />;
  }
  if (tipo === "feedback_quinzenal" && isObj && (dados.identificacao || dados.evolucao || dados.recuperacao || dados.qualidade_vida || dados.treino || dados.dieta)) {
    return (
      <div className="space-y-4">
        {Object.entries(FB_QUINZENAL_LABELS).map(([blockKey, def]) => {
          const block = dados[blockKey];
          if (!block || typeof block !== "object") return null;
          return (
            <div key={blockKey} className="rounded-md border border-border bg-muted/30 p-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">{def.titulo}</h4>
              <dl className="space-y-2">
                {Object.entries(def.campos).map(([fk, fl]) => {
                  const v = (block as any)[fk];
                  if (v === undefined || v === null || v === "") return null;
                  const rendered = formatFieldValue(fk, v);
                  if (rendered === null) return null;
                  return (
                    <div key={fk}>
                      <dt className="text-[11px] font-medium text-muted-foreground">{fl}</dt>
                      <dd>{rendered}</dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          );
        })}
        {typeof dados.desabafo === "string" && dados.desabafo.trim() && (
          <div className="rounded-md border border-border bg-muted/30 p-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Sessão desabafo</h4>
            <p className="text-sm whitespace-pre-wrap">{dados.desabafo}</p>
          </div>
        )}
        {typeof dados.espaco_livre === "string" && dados.espaco_livre.trim() && (
          <div className="rounded-md border border-border bg-muted/30 p-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Espaço livre</h4>
            <p className="text-sm whitespace-pre-wrap">{dados.espaco_livre}</p>
          </div>
        )}
      </div>
    );
  }
  if (tipo === "feedback_mensal" && isObj && (dados.identificacao || dados.evolucao || dados.recuperacao || dados.fotos)) {
    const fotos = (dados.fotos && typeof dados.fotos === "object") ? dados.fotos : null;
    return (
      <div className="space-y-4">
        {Object.entries(FB_MENSAL_LABELS).map(([blockKey, def]) => {
          const block = dados[blockKey];
          if (!block || typeof block !== "object") return null;
          return (
            <div key={blockKey} className="rounded-md border border-border bg-muted/30 p-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">{def.titulo}</h4>
              <dl className="space-y-2">
                {Object.entries(def.campos).map(([fk, fl]) => {
                  const v = (block as any)[fk];
                  if (v === undefined || v === null || v === "") return null;
                  const rendered = formatFieldValue(fk, v);
                  if (rendered === null) return null;
                  return (
                    <div key={fk}>
                      <dt className="text-[11px] font-medium text-muted-foreground">{fl}</dt>
                      <dd>{rendered}</dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          );
        })}
        {(typeof dados.sessao_desabafo === "string" && dados.sessao_desabafo.trim()) && (
          <div className="rounded-md border border-border bg-muted/30 p-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Sessão desabafo</h4>
            <p className="text-sm whitespace-pre-wrap">{dados.sessao_desabafo}</p>
          </div>
        )}
        {fotos && (fotos.frente || fotos.costas || fotos.perfil_esquerdo) && (
          <div className="rounded-md border border-border bg-muted/30 p-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Fotos de avaliação</h4>
            <div className="grid grid-cols-3 gap-2">
              {(["frente", "costas", "perfil_esquerdo"] as const).map((slot) => {
                const url = (fotos as any)[slot] as string | undefined;
                const label = slot === "perfil_esquerdo" ? "Perfil esq." : slot === "costas" ? "Costas" : "Frente";
                return <FotoSlot key={slot} url={url || ""} label={label} />;
              })}
            </div>
          </div>
        )}
        {typeof dados.espaco_livre === "string" && dados.espaco_livre.trim() && (
          <div className="rounded-md border border-border bg-muted/30 p-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Espaço livre</h4>
            <p className="text-sm whitespace-pre-wrap">{dados.espaco_livre}</p>
          </div>
        )}
      </div>
    );
  }

  // Anamnese ou formato genérico: renderiza objeto top-level com blocos legíveis
  if (isObj) {
    const entries = Object.entries(dados as Record<string, any>);
    return (
      <div className="space-y-4">
        {entries.map(([k, v]) => (
          <div key={k} className="rounded-md border border-border bg-muted/30 p-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">{humanizeKey(k)}</h4>
            <RenderValor valor={v} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <pre className="text-xs bg-muted/50 border border-border rounded-md p-3 overflow-auto whitespace-pre-wrap">
      {JSON.stringify(dados, null, 2)}
    </pre>
  );
}

/* ============ Anamnese render — segue ordem do AnamneseFlow ============ */

type CampoDef = { key: string; label: string };

const ANAMNESE_BLOCKS: { key: string; titulo: string; campos: CampoDef[] }[] = [
  {
    key: "dados_pessoais", titulo: "Dados pessoais", campos: [
      { key: "nome", label: "Nome completo" },
      { key: "email", label: "E-mail" },
      { key: "telefone", label: "Telefone com DDD" },
      { key: "nascimento", label: "Data de nascimento" },
      { key: "genero", label: "Gênero" },
      { key: "peso", label: "Peso atual (kg)" },
      { key: "altura", label: "Altura (cm)" },
      { key: "como_conheceu", label: "Como me conheceu" },
      { key: "instagram", label: "Instagram (@)" },
    ],
  },
  {
    key: "historico", titulo: "Histórico", campos: [
      { key: "acomp_online", label: "Já teve acompanhamento online anteriormente? Como foi?" },
      { key: "acomp_nutri", label: "Já teve acompanhamento nutricional? O que funcionou e o que não?" },
    ],
  },
  {
    key: "saude", titulo: "Saúde", campos: [
      { key: "plano_saude", label: "Possui plano de saúde?" },
      { key: "ultimos_exames", label: "Quando realizou seus últimos exames de sangue?" },
      { key: "exames_arquivos", label: "Exames anexados" },
      { key: "medicacao", label: "Faz uso de medicação contínua? Se sim, quais?" },
      { key: "cirurgia", label: "Já realizou alguma cirurgia?" },
      { key: "cirurgia_qual", label: "Qual cirurgia?" },
      { key: "contraceptivo", label: "Faz uso de método contraceptivo? Qual?" },
    ],
  },
  {
    key: "objetivo", titulo: "Objetivo", campos: [
      { key: "objetivo_principal", label: "Qual é o seu objetivo principal?" },
      { key: "grupos_prioridade", label: "Quais grupos musculares você gostaria de priorizar?" },
      { key: "piramide", label: "Pirâmide de preferência" },
    ],
  },
  {
    key: "ergogenicos", titulo: "Recursos ergogênicos", campos: [
      { key: "ja_usou_esteroides", label: "Já fez uso de esteroides anabolizantes?" },
      { key: "esteroides_historico", label: "Histórico de uso (substâncias, tempo, dosagens)" },
      { key: "pretende_usar", label: "Pretende fazer uso?" },
      { key: "sensibilidade_cafeina", label: "Tem sensibilidade à cafeína?" },
      { key: "pre_treino", label: "Usa ou já usou pré-treino? Qual?" },
    ],
  },
  {
    key: "treino", titulo: "Treino", campos: [
      { key: "tempo_treino", label: "Há quanto tempo treina?" },
      { key: "modalidade", label: "Qual modalidade pratica?" },
      { key: "frequencia", label: "Quantas vezes/semana pretende treinar?" },
      { key: "horario", label: "Horário preferido" },
      { key: "duracao", label: "Quanto tempo pretende ficar na academia?" },
      { key: "divisao", label: "Divisão de treino atual" },
    ],
  },
  {
    key: "alimentacao", titulo: "Rotina e alimentação", campos: [
      { key: "esforco_diario", label: "Esforço físico do dia a dia" },
      { key: "compulsao", label: "Tem compulsão por doce ou algum alimento específico?" },
      { key: "refeicoes_dia", label: "Quantas refeições faz por dia?" },
      { key: "suplementos", label: "Faz uso de suplementos? Quais?" },
      { key: "horario_fome", label: "Em qual horário sente mais fome?" },
      { key: "descontar_emocoes", label: "Costuma descontar emoções na comida?" },
      { key: "intolerancia", label: "Possui intolerância ou alergia alimentar?" },
      { key: "solidas", label: "Consegue fazer refeições sólidas em qualquer horário?" },
      { key: "alimentos_nao_vive_sem", label: "10 alimentos que não vive sem" },
      { key: "alimentos_nao_come", label: "5 alimentos que não consegue comer" },
    ],
  },
  {
    key: "habitos", titulo: "Sono e hábitos", campos: [
      { key: "dorme_bem", label: "Dorme bem?" },
      { key: "acorda_descansado", label: "Acorda descansado?" },
      { key: "horas_sono", label: "Quantas horas por noite?" },
      { key: "banheiro", label: "Vai ao banheiro todos os dias?" },
      { key: "evacua", label: "Evacua sem dor ou dificuldade?" },
      { key: "agua_litros", label: "Quantidade de água por dia (litros)" },
      { key: "alcool", label: "Faz uso de bebida alcoólica?" },
    ],
  },
];

const RECORDATORIO_LABELS: Record<string, string> = {
  cafe_manha: "Café da manhã",
  lanche_manha: "Lanche da manhã",
  almoco: "Almoço",
  lanche_tarde: "Lanche da tarde",
  jantar: "Jantar",
  ceia: "Ceia",
};

const RISCO_PESSOAL_LABELS: Record<string, string> = {
  fuma: "Fuma",
  diabetes: "Diabetes",
  sobrepeso: "Sobrepeso ou obesidade",
  sedentarismo: "Sedentarismo",
  dislipidemias: "Dislipidemias",
};
const RISCO_FAM_LABELS: Record<string, string> = {
  diabetes: "Diabetes",
  hipertensao: "Hipertensão",
  cardiovasculares: "Doenças cardiovasculares",
  derrame: "Derrame",
  cancer: "Câncer",
  obesidade: "Obesidade",
};

function BlocoCard({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 p-3">
      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">{titulo}</h4>
      {children}
    </div>
  );
}

/* ============ Anamnese — payload "flat" (webhook público) ============ */

const ANAMNESE_FLAT_BLOCKS: { titulo: string; campos: { key: string; label: string }[] }[] = [
  {
    titulo: "Dados pessoais",
    campos: [
      { key: "nome", label: "Nome completo" },
      { key: "email", label: "E-mail" },
      { key: "telefone", label: "Telefone" },
      { key: "data_nascimento", label: "Data de nascimento" },
      { key: "genero", label: "Gênero" },
      { key: "peso_kg", label: "Peso (kg)" },
      { key: "altura_cm", label: "Altura (cm)" },
      { key: "regiao", label: "Região" },
      { key: "instagram", label: "Instagram" },
      { key: "como_conheceu", label: "Como me conheceu" },
    ],
  },
  {
    titulo: "Objetivo e treino",
    campos: [
      { key: "objetivo", label: "Objetivo principal" },
      { key: "modalidade", label: "Modalidade" },
      { key: "tempo_treino", label: "Tempo de treino" },
      { key: "frequencia_treino", label: "Frequência semanal" },
      { key: "tempo_academia", label: "Tempo na academia" },
      { key: "horario_treino", label: "Horário do treino" },
      { key: "divisao_treino", label: "Divisão de treino" },
      { key: "grupos_prioridade", label: "Grupos prioritários" },
    ],
  },
  {
    titulo: "Saúde",
    campos: [
      { key: "condicoes_saude", label: "Condições de saúde" },
      { key: "lesao", label: "Possui lesão?" },
      { key: "lesao_qual", label: "Qual lesão?" },
      { key: "limitacao", label: "Possui limitação?" },
      { key: "limitacao_qual", label: "Qual limitação?" },
      { key: "medicacao", label: "Medicação contínua" },
      { key: "cirurgia", label: "Já fez cirurgia?" },
      { key: "cirurgia_qual", label: "Qual cirurgia?" },
      { key: "plano_saude", label: "Plano de saúde" },
      { key: "ultimos_exames", label: "Últimos exames" },
      { key: "contraceptivo", label: "Método contraceptivo" },
    ],
  },
  {
    titulo: "Alimentação",
    campos: [
      { key: "num_refeicoes", label: "Refeições por dia" },
      { key: "agua_dia", label: "Água por dia" },
      { key: "intolerancias", label: "Intolerâncias / alergias" },
      { key: "alimentos_gosta", label: "Alimentos que gosta" },
      { key: "alimentos_nao_consome", label: "Alimentos que não consome" },
      { key: "suplementos", label: "Suplementos" },
      { key: "compulsao", label: "Compulsão" },
      { key: "horario_fome", label: "Horário de mais fome" },
    ],
  },
  {
    titulo: "Recordatório alimentar",
    campos: [
      { key: "cafe_manha_horario", label: "Café da manhã (horário)" },
      { key: "cafe_manha_come", label: "Café da manhã" },
      { key: "lanche_manha_horario", label: "Lanche da manhã (horário)" },
      { key: "lanche_manha_come", label: "Lanche da manhã" },
      { key: "almoco_horario", label: "Almoço (horário)" },
      { key: "almoco_come", label: "Almoço" },
      { key: "lanche_tarde_horario", label: "Lanche da tarde (horário)" },
      { key: "lanche_tarde_come", label: "Lanche da tarde" },
      { key: "jantar_horario", label: "Jantar (horário)" },
      { key: "jantar_come", label: "Jantar" },
      { key: "ceia_horario", label: "Ceia (horário)" },
      { key: "ceia_come", label: "Ceia" },
    ],
  },
  {
    titulo: "Sono e hábitos",
    campos: [
      { key: "dorme_bem", label: "Dorme bem?" },
      { key: "horas_sono", label: "Horas de sono" },
      { key: "acorda_descansado", label: "Acorda descansado?" },
      { key: "intestino", label: "Intestino" },
      { key: "alcool", label: "Bebida alcoólica" },
      { key: "fuma", label: "Fuma" },
      { key: "esforco_diario", label: "Esforço físico diário" },
    ],
  },
];

const ANAMNESE_FLAT_KNOWN = new Set<string>(
  ANAMNESE_FLAT_BLOCKS.flatMap((b) => b.campos.map((c) => c.key)),
);

function AnamneseFlatRender({ dados }: { dados: any }) {
  const obs = typeof dados?.observacoes === "string" ? dados.observacoes.trim() : "";
  const fotos = dados?.fotos && typeof dados.fotos === "object" ? dados.fotos : null;

  return (
    <div className="space-y-4">
      {ANAMNESE_FLAT_BLOCKS.map((bloco) => {
        const linhas = bloco.campos
          .map((c) => ({ c, rendered: renderAnamneseValor(c.key, dados?.[c.key]) }))
          .filter((l) => l.rendered !== null);
        if (linhas.length === 0) return null;
        return (
          <BlocoCard key={bloco.titulo} titulo={bloco.titulo}>
            <dl className="space-y-2">
              {linhas.map(({ c, rendered }) => (
                <div key={c.key}>
                  <dt className="text-[11px] font-medium text-muted-foreground">{c.label}</dt>
                  <dd>{rendered}</dd>
                </div>
              ))}
            </dl>
          </BlocoCard>
        );
      })}

      {obs && (
        <BlocoCard titulo="Observações">
          <p className="text-sm whitespace-pre-wrap">{obs}</p>
        </BlocoCard>
      )}

      {fotos && (fotos.frente || fotos.costas || fotos.perfil_esquerdo) && (
        <BlocoCard titulo="Fotos de avaliação">
          <div className="grid grid-cols-3 gap-2">
            {(["frente", "costas", "perfil_esquerdo"] as const).map((slot) => {
              const url = (fotos as any)[slot] as string | undefined;
              const label = slot === "perfil_esquerdo" ? "Perfil esq." : slot === "costas" ? "Costas" : "Frente";
              return <FotoSlot key={slot} url={url || ""} label={label} />;
            })}
          </div>
        </BlocoCard>
      )}

      {(() => {
        const extras = Object.entries(dados || {})
          .filter(([k, v]) =>
            !ANAMNESE_FLAT_KNOWN.has(k) &&
            k !== "observacoes" &&
            v !== null && v !== undefined && v !== "" &&
            typeof v !== "object",
          );
        if (extras.length === 0) return null;
        return (
          <BlocoCard titulo="Outras informações">
            <dl className="space-y-2">
              {extras.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[11px] font-medium text-muted-foreground">{humanizeKey(k)}</dt>
                  <dd className="text-sm whitespace-pre-wrap">{String(v)}</dd>
                </div>
              ))}
            </dl>
          </BlocoCard>
        );
      })()}
    </div>
  );
}

function renderAnamneseValor(fieldKey: string, value: any): React.ReactNode {
  if (value === null || value === undefined || value === "") return null;
  if (fieldKey === "exames_arquivos" && Array.isArray(value)) {
    if (value.length === 0) return null;
    return (
      <ul className="list-disc ml-5 text-sm space-y-0.5">
        {value.map((f: any, i: number) => (
          <li key={i}>
            {f?.url ? (
              <a href={f.url} target="_blank" rel="noreferrer" className="text-primary underline break-all">
                {f.name || f.url}
              </a>
            ) : (
              String(f)
            )}
          </li>
        ))}
      </ul>
    );
  }
  if (typeof value === "string" && /^https?:\/\//i.test(value.trim())) {
    return <a href={value} target="_blank" rel="noreferrer" className="text-primary text-sm underline break-all">{value}</a>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    return <span className="text-sm whitespace-pre-wrap">{value.map((v) => (typeof v === "object" ? JSON.stringify(v) : String(v))).join(", ")}</span>;
  }
  return <span className="text-sm whitespace-pre-wrap">{String(value)}</span>;
}

function AnamneseRender({ dados }: { dados: any }) {
  const fotos = dados?.fotos && typeof dados.fotos === "object" ? dados.fotos : null;
  const recordatorio = dados?.recordatorio && typeof dados.recordatorio === "object" ? dados.recordatorio : null;
  const risco = dados?.fatores_risco && typeof dados.fatores_risco === "object" ? dados.fatores_risco : null;
  const desabafo = typeof dados?.desabafo === "string" ? dados.desabafo.trim() : "";

  // Detecta payload "achatado" (vindo do webhook público): nenhuma das chaves de bloco existe,
  // mas existem campos de topo conhecidos (nome/peso_kg/objetivo etc.). Nesse caso, renderiza
  // diretamente as chaves de topo com rótulos amigáveis.
  const temBlocoConhecido = ANAMNESE_BLOCKS.some(
    (b) => dados && typeof dados[b.key] === "object" && dados[b.key] !== null,
  );
  if (!temBlocoConhecido && dados && typeof dados === "object") {
    return <AnamneseFlatRender dados={dados} />;
  }

  return (
    <div className="space-y-4">
      {ANAMNESE_BLOCKS.map((bloco) => {
        const block = dados?.[bloco.key];
        if (!block || typeof block !== "object") return null;
        const linhas = bloco.campos
          .map((c) => ({ c, rendered: renderAnamneseValor(c.key, (block as any)[c.key]) }))
          .filter((l) => l.rendered !== null);
        if (linhas.length === 0) return null;
        return (
          <BlocoCard key={bloco.key} titulo={bloco.titulo}>
            <dl className="space-y-2">
              {linhas.map(({ c, rendered }) => (
                <div key={c.key}>
                  <dt className="text-[11px] font-medium text-muted-foreground">{c.label}</dt>
                  <dd>{rendered}</dd>
                </div>
              ))}
            </dl>
          </BlocoCard>
        );
      })}

      {risco && (risco.pessoal || risco.familiar) && (
        <BlocoCard titulo="Fatores de risco">
          {risco.pessoal && typeof risco.pessoal === "object" && (
            <div className="mb-3">
              <h5 className="text-[11px] font-semibold text-foreground mb-1.5">Seus fatores</h5>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                {Object.entries(RISCO_PESSOAL_LABELS).map(([k, label]) => {
                  const v = (risco.pessoal as any)[k];
                  if (v === undefined || v === null || v === "") return null;
                  return (
                    <div key={k} className="flex justify-between gap-2">
                      <dt className="text-[11px] text-muted-foreground">{label}</dt>
                      <dd className="text-sm font-medium">{String(v)}</dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          )}
          {risco.familiar && typeof risco.familiar === "object" && (
            <div>
              <h5 className="text-[11px] font-semibold text-foreground mb-1.5">Histórico familiar</h5>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                {Object.entries(RISCO_FAM_LABELS).map(([k, label]) => {
                  const v = (risco.familiar as any)[k];
                  if (v === undefined || v === null || v === "") return null;
                  return (
                    <div key={k} className="flex justify-between gap-2">
                      <dt className="text-[11px] text-muted-foreground">{label}</dt>
                      <dd className="text-sm font-medium">{String(v)}</dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          )}
        </BlocoCard>
      )}

      {recordatorio && (
        <BlocoCard titulo="Recordatório alimentar">
          <div className="space-y-2">
            {Object.entries(RECORDATORIO_LABELS).map(([k, label]) => {
              const r = (recordatorio as any)[k];
              if (!r || (typeof r === "object" && !r.horario && !r.comida)) return null;
              return (
                <div key={k} className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3 border-b border-border last:border-0 pb-2 last:pb-0">
                  <div className="text-[11px] font-semibold text-foreground sm:w-32 shrink-0">
                    {label} {r.horario && <span className="font-normal text-muted-foreground">· {r.horario}</span>}
                  </div>
                  <div className="text-sm whitespace-pre-wrap flex-1">{r.comida || "—"}</div>
                </div>
              );
            })}
          </div>
        </BlocoCard>
      )}

      {fotos && (fotos.frente || fotos.costas || fotos.perfil_esquerdo) && (
        <BlocoCard titulo="Fotos de avaliação">
          <div className="grid grid-cols-3 gap-2">
            {(["frente", "costas", "perfil_esquerdo"] as const).map((slot) => {
              const url = (fotos as any)[slot] as string | undefined;
              const label = slot === "perfil_esquerdo" ? "Perfil esq." : slot === "costas" ? "Costas" : "Frente";
              return <FotoSlot key={slot} url={url || ""} label={label} />;
            })}
          </div>
        </BlocoCard>
      )}

      {desabafo && (
        <BlocoCard titulo="Desabafo">
          <p className="text-sm whitespace-pre-wrap">{desabafo}</p>
        </BlocoCard>
      )}
    </div>
  );
}