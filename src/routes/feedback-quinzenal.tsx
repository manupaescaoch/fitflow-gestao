import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/feedback-quinzenal")({
  head: () => ({
    meta: [
      { title: "Feedback Quinzenal | MPTEAM" },
      { name: "description", content: "O feedback quinzenal da MPTEAM agora é feito direto pelo WhatsApp." },
    ],
  }),
  component: FeedbackQuinzenalPublicaPage,
});

function FeedbackQuinzenalPublicaPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold">Feedback quinzenal</h1>
      <p className="text-muted-foreground">
        O feedback quinzenal não é mais preenchido por formulário. A cada 15 dias você recebe
        uma mensagem no WhatsApp e pode responder por lá mesmo, em texto ou áudio.
      </p>
      <p className="text-muted-foreground">
        O feedback mensal continua normalmente e é ele que atualiza seu treino e sua dieta.
      </p>
    </main>
  );
}