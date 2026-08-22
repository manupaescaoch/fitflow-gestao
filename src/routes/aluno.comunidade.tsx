import { createFileRoute } from "@tanstack/react-router";
import { Heart, ImagePlus, Loader2, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAlunoSession } from "@/lib/aluno-session";
import { ProfileAvatar } from "@/components/aluno-app/ProfileAvatar";
import { useSignedPhotoUrl } from "@/lib/use-signed-photo-url";
import {
  listarFeed,
  criarPost,
  togglarLike,
  apagarPost,
  type FeedPost,
} from "@/server/comunidade.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/aluno/comunidade")({
  component: AlunoComunidade,
});

function tempoRel(iso: string) {
  const d = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - d);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  const dias = Math.floor(h / 24);
  if (dias < 7) return `há ${dias}d`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

function PostCard({
  post,
  onLike,
  onDelete,
  meuId,
}: {
  post: FeedPost;
  onLike: (p: FeedPost) => void;
  onDelete: (p: FeedPost) => void;
  meuId: string | null;
}) {
  const isMine = meuId === post.aluno_id;
  const handle = post.username ? `@${post.username}` : null;
  const avatarUrl = useSignedPhotoUrl(post.foto_perfil, "avatar");
  const fotoPostUrl = useSignedPhotoUrl(post.foto_url, "comunidade");
  return (
    <article className="rounded-3xl bg-white border border-black/5 shadow-[0_2px_14px_rgba(0,0,0,0.04)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-3">
        <div className="h-10 w-10 rounded-full overflow-hidden ring-1 ring-black/5 bg-black/10 shrink-0">
          {avatarUrl ? (
            <div
              className="h-full w-full bg-cover bg-center"
              style={{ backgroundImage: `url(${avatarUrl})` }}
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-black/70 to-black/40 flex items-center justify-center text-white text-[12px] font-bold">
              {post.nome.slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-bold text-black leading-tight truncate">
            {post.nome}
          </div>
          {handle && (
            <div className="text-[11px] text-black/45 font-medium truncate">{handle}</div>
          )}
        </div>
        <span className="text-[11px] text-black/40 font-medium">
          {tempoRel(post.created_at)}
        </span>
        {isMine && (
          <button
            onClick={() => onDelete(post)}
            className="ml-1 p-1.5 rounded-lg text-black/40 hover:text-[#F70906] active:scale-95"
            aria-label="Apagar"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Imagem */}
      <div
        className="aspect-square w-full bg-black/5 bg-cover bg-center"
        style={fotoPostUrl ? { backgroundImage: `url(${fotoPostUrl})` } : undefined}
      />

      {/* Ações */}
      <div className="px-3 pt-3 pb-1 flex items-center gap-3">
        <button
          onClick={() => onLike(post)}
          className="active:scale-90 transition"
          aria-label="Curtir"
        >
          <Heart
            className={`h-7 w-7 ${
              post.liked_by_me ? "text-[#F70906]" : "text-black"
            }`}
            fill={post.liked_by_me ? "#F70906" : "none"}
            strokeWidth={post.liked_by_me ? 0 : 2}
          />
        </button>
      </div>
      <div className="px-3 pb-3 space-y-1">
        <div className="text-[13px] font-bold text-black">
          {post.likes} {post.likes === 1 ? "curtida" : "curtidas"}
        </div>
        {post.legenda && (
          <p className="text-[13px] text-black leading-snug">
            <span className="font-bold mr-1">{handle ?? post.nome}</span>
            {post.legenda}
          </p>
        )}
      </div>
    </article>
  );
}

function AlunoComunidade() {
  const { session } = useAlunoSession();
  const meuId = session?.id ?? null;

  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [criando, setCriando] = useState(false);
  const [arquivo, setArquivo] = useState<{ data: string; mime: string } | null>(null);
  const [legenda, setLegenda] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function refetch() {
    try {
      const data = await listarFeed();
      setPosts(data);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refetch();
    // Polling: alunos não têm sessão Supabase Auth, então Realtime via
    // postgres_changes é bloqueado pelo RLS. Usamos polling leve + refetch
    // ao voltar o foco/visibilidade para manter o feed atualizado.
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") refetch();
    }, 20000);
    const onVisible = () => {
      if (document.visibilityState === "visible") refetch();
    };
    const onFocus = () => refetch();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meuId]);

  function abrirSeletor() {
    fileRef.current?.click();
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("Selecione uma imagem.");
      return;
    }
    if (f.size > 8 * 1024 * 1024) {
      toast.error("Imagem deve ter até 8MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setArquivo({ data: reader.result as string, mime: f.type });
    reader.readAsDataURL(f);
  }

  async function publicar() {
    if (!meuId || !arquivo) return;
    setCriando(true);
    try {
      const r = await criarPost({
        data: {
          file_base64: arquivo.data,
          content_type: arquivo.mime,
          legenda: legenda.trim() || null,
        },
      });
      if (!r.ok) throw new Error(r.error);
      setArquivo(null);
      setLegenda("");
      toast.success("Publicado!");
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao publicar");
    } finally {
      setCriando(false);
    }
  }

  async function curtir(p: FeedPost) {
    if (!meuId) return;
    // otimista
    setPosts((prev) =>
      prev.map((x) =>
        x.id === p.id
          ? {
              ...x,
              liked_by_me: !x.liked_by_me,
              likes: x.likes + (x.liked_by_me ? -1 : 1),
            }
          : x,
      ),
    );
    try {
      await togglarLike({ data: { post_id: p.id } });
    } catch (e) {
      refetch();
    }
  }

  async function apagar(p: FeedPost) {
    if (!meuId) return;
    if (!confirm("Apagar esta publicação?")) return;
    try {
      const r = await apagarPost({ data: { post_id: p.id } });
      if (!r.ok) throw new Error(r.error);
      setPosts((prev) => prev.filter((x) => x.id !== p.id));
    } catch (e: any) {
      toast.error(e?.message ?? "Erro");
    }
  }

  return (
    <div className="px-5 pt-4 pb-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between pt-2">
        <div>
          <h1 className="text-[36px] leading-none font-black tracking-tight text-black">
            Comunidade
          </h1>
          <p className="mt-2 text-[14px] text-black/45 font-medium">
            Feed da MPTEAM. Só foto e curtida.
          </p>
        </div>
        <ProfileAvatar />
      </div>

      {/* Criar post */}
      <div className="rounded-3xl bg-white border border-black/5 shadow-[0_2px_14px_rgba(0,0,0,0.04)] p-3.5 space-y-3">
        {!arquivo ? (
          <button
            onClick={abrirSeletor}
            className="w-full flex items-center gap-3 active:scale-[0.99] transition"
          >
            <div className="h-12 w-12 rounded-2xl bg-[#F70906]/10 flex items-center justify-center shrink-0">
              <ImagePlus className="h-5 w-5 text-[#F70906]" strokeWidth={2.4} />
            </div>
            <div className="text-left">
              <div className="text-[14px] font-bold text-black">Compartilhar uma foto</div>
              <div className="text-[12px] text-black/45 font-medium">
                Escolha uma imagem do seu celular
              </div>
            </div>
          </button>
        ) : (
          <div className="space-y-3">
            <div className="relative">
              <img
                src={arquivo.data}
                alt="Preview"
                className="w-full aspect-square object-cover rounded-2xl"
              />
              <button
                onClick={() => setArquivo(null)}
                className="absolute top-2 right-2 h-8 w-8 rounded-full bg-black/70 text-white flex items-center justify-center active:scale-90"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <textarea
              value={legenda}
              onChange={(e) => setLegenda(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="Escreva uma legenda (opcional)"
              className="w-full bg-black/[0.03] rounded-2xl px-3 py-2.5 text-[13px] outline-none placeholder:text-black/35 font-medium resize-none"
            />
            <button
              onClick={publicar}
              disabled={criando}
              className="w-full h-12 rounded-2xl bg-[#F70906] text-white font-bold text-[14px] flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(247,9,6,0.3)] active:scale-[0.98] disabled:opacity-60"
            >
              {criando && <Loader2 className="h-4 w-4 animate-spin" />}
              {criando ? "Publicando..." : "Publicar"}
            </button>
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onFile}
        />
      </div>

      {/* Feed */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[#F70906]" />
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-3xl bg-white border border-black/5 p-8 text-center">
          <div className="h-14 w-14 rounded-2xl bg-[#F70906]/10 mx-auto flex items-center justify-center">
            <ImagePlus className="h-6 w-6 text-[#F70906]" strokeWidth={2.2} />
          </div>
          <div className="mt-3 text-[15px] font-bold text-black">Sem publicações ainda</div>
          <div className="text-[12px] text-black/50 font-medium mt-1">
            Seja o primeiro a compartilhar uma foto.
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              onLike={curtir}
              onDelete={apagar}
              meuId={meuId}
            />
          ))}
        </div>
      )}
    </div>
  );
}