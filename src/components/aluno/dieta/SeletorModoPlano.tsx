import { Calculator, FileText } from "lucide-react";

export function SeletorModoPlano({
  onEscolher,
  canEdit,
}: {
  onEscolher: (modo: "calculado" | "texto_livre") => void;
  canEdit: boolean;
}) {
  return (
    <div className="py-10 px-6">
      <div className="max-w-3xl mx-auto text-center mb-8">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900 mb-2">
          Como você quer montar o plano alimentar?
        </h2>
        <p className="text-sm text-muted-foreground">
          Escolha o modelo de plano. Você pode trocar ou ajustar refeições individualmente depois.
        </p>
      </div>

      <div className="max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          disabled={!canEdit}
          onClick={() => onEscolher("calculado")}
          className="group text-left rounded-2xl border border-slate-200 bg-white p-6 hover:border-rose-300 hover:shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-50 to-rose-100 grid place-items-center mb-4 group-hover:scale-105 transition">
            <Calculator className="w-6 h-6 text-rose-600" />
          </div>
          <div className="text-[15px] font-semibold text-slate-900 mb-1">Alimentos calculados</div>
          <p className="text-[13px] text-slate-500 leading-relaxed">
            Itens estruturados com cálculo automático de kcal, PTN, CHO e LIP a partir do banco de alimentos.
            Ideal para precisão e ajustes finos.
          </p>
          <div className="mt-4 text-[11px] text-rose-600 font-medium">
            Recomendado · Gerar IA, importar e templates
          </div>
        </button>

        <button
          disabled={!canEdit}
          onClick={() => onEscolher("texto_livre")}
          className="group text-left rounded-2xl border border-slate-200 bg-white p-6 hover:border-amber-300 hover:shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-50 to-amber-100 grid place-items-center mb-4 group-hover:scale-105 transition">
            <FileText className="w-6 h-6 text-amber-600" />
          </div>
          <div className="text-[15px] font-semibold text-slate-900 mb-1">Texto livre</div>
          <p className="text-[13px] text-slate-500 leading-relaxed">
            Cada refeição é uma caixa de texto. Cole opções 1/2/3 prontas e digite manualmente o total
            de macros do dia. Sem cálculo automático.
          </p>
          <div className="mt-4 text-[11px] text-amber-600 font-medium">
            Rápido · Cole e pronto
          </div>
        </button>
      </div>
    </div>
  );
}
