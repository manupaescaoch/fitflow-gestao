import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

export function AlertaSignFalha({ signFails, photoIssues, onClick }: { signFails: number; photoIssues: number; onClick?: () => void }) {
  if (!signFails && !photoIssues) return null;
  return (
    <Alert variant="destructive" className="cursor-pointer" onClick={onClick}>
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Atenção: falha ao assinar URLs de fotos</AlertTitle>
      <AlertDescription>
        Existem alunos com fotos que podem ficar indisponíveis. {signFails > 0 && `${signFails} falha(s) técnica(s) registrada(s). `}
        {photoIssues > 0 && `${photoIssues} URL(s) com problema. `}
        Clique para verificar a Auditoria de Fotos.
      </AlertDescription>
    </Alert>
  );
}
