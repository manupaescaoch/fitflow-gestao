import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

export function EmBreve({
  titulo,
  subtitulo,
  icon: Icon,
}: {
  titulo: string;
  subtitulo: string;
  icon: LucideIcon;
}) {
  return (
    <div className="px-5 pt-8 pb-12">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl bg-white border border-black/5 p-8 text-center shadow-[0_4px_24px_-12px_rgba(0,0,0,0.08)]"
      >
        <div className="mx-auto h-16 w-16 rounded-2xl bg-gradient-to-br from-[#F70906] to-[#c40503] text-white flex items-center justify-center shadow-[0_14px_30px_-12px_rgba(247,9,6,0.6)]">
          <Icon className="h-7 w-7" />
        </div>
        <h1 className="mt-5 text-xl font-extrabold tracking-tight">{titulo}</h1>
        <p className="mt-2 text-sm text-black/55 leading-relaxed max-w-[260px] mx-auto">
          {subtitulo}
        </p>
        <div className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-black/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-black/55">
          Em breve
        </div>
      </motion.div>
    </div>
  );
}