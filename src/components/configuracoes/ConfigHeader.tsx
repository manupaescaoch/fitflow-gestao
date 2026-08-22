import { Settings } from "lucide-react";

export function ConfigHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center">
        <Settings className="h-5 w-5 text-primary" />
      </div>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}