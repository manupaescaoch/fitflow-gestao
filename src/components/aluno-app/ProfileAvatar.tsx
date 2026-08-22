import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useAlunoSession } from "@/lib/aluno-session";
import { useSignedPhotoUrl } from "@/lib/use-signed-photo-url";

export function ProfileAvatar() {
  const { session } = useAlunoSession();
  const avatar = useSignedPhotoUrl(session?.avatarUrl ?? null, "avatar");
  const initials = (session?.nome || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("") || "?";
  return (
    <Link to="/aluno/perfil" className="relative shrink-0" aria-label="Perfil">
      <div className="h-11 w-11 rounded-full overflow-hidden ring-1 ring-black/5 bg-gradient-to-br from-neutral-700 to-neutral-900 flex items-center justify-center">
        {avatar ? (
          <div
            className="h-full w-full bg-cover bg-center"
            style={{ backgroundImage: `url(${avatar})` }}
          />
        ) : (
          <span className="text-white text-sm font-semibold tracking-wide">
            {initials}
          </span>
        )}
      </div>
      <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-[#F70906] ring-2 ring-[#FAFAFA] flex items-center justify-center">
        <Bell className="h-2 w-2 text-white" strokeWidth={3} />
      </span>
    </Link>
  );
}