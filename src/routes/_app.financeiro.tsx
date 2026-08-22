import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/financeiro")({
  component: FinanceiroLayout,
});

function FinanceiroLayout() {
  return (
    <div className="financeiro-light space-y-6 max-w-[1400px] mx-auto">
      <Outlet />
    </div>
  );
}