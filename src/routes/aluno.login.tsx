import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/aluno/login")({
  component: () => <Navigate to="/login" replace />,
});
