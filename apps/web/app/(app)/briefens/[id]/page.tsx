import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { MarkdownProse } from "@/components/briefens/markdown-prose";
import { BriefenPending } from "@/components/briefens/briefen-pending";
import { formatNumber, relativeTime } from "@/lib/formatters";
import type { Briefen } from "@/lib/types";

type BriefenWithICP = Briefen & { icps: { name: string } | null };

type BriefenVideo = {
  briefen_id: string;
  video_id: string;
  rank: number;
  views_at_briefen: number | null;
  videos: {
    id: string;
    youtube_id: string;
    title: string;
    thumbnail_url: string | null;
    views: number;
  } | null;
};

export default async function BriegenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerClient();

  const { data: briefen } = await supabase
    .from("briefens")
    .select("*, icps(name)")
    .eq("id", id)
    .single<BriefenWithICP>();

  if (!briefen) notFound();

  const { data: briefenVideos } = await supabase
    .from("briefen_videos")
    .select("*, videos(id, youtube_id, title, thumbnail_url, views)")
    .eq("briefen_id", id)
    .order("rank")
    .returns<BriefenVideo[]>();

  const channelCount = briefen.selected_channel_ids?.length ?? 0;

  return (
    <div>
      <Link
        href="/briefens"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ChevronLeft size={14} strokeWidth={1.5} />
        Briefens
      </Link>

      <div className="flex gap-12 items-start">
        {/* ── Main column ── */}
        <div className="flex-1 min-w-0" style={{ maxWidth: 720 }}>
          {/* Metadata */}
          <div className="mb-8 pb-6 border-b border-border">
            <h1 className="text-xl font-medium text-foreground mb-3">
              {briefen.title ?? "Briefen"}
            </h1>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {briefen.icps?.name && <span>{briefen.icps.name}</span>}
              {channelCount > 0 && (
                <span>
                  {channelCount} canal{channelCount !== 1 ? "is" : ""}
                </span>
              )}
              <span>{relativeTime(briefen.created_at)}</span>
              {briefen.model_used && <span>{briefen.model_used}</span>}
            </div>
          </div>

          {/* Content */}
          {briefen.status === "completed" && briefen.result ? (
            <MarkdownProse content={briefen.result} />
          ) : briefen.status === "pending" || briefen.status === "running" ? (
            <BriefenPending briefenId={briefen.id} />
          ) : briefen.status === "failed" ? (
            <div className="py-8 text-sm text-destructive">
              Erro ao gerar briefen: {briefen.error_message ?? "motivo desconhecido."}
            </div>
          ) : null}
        </div>

        {/* ── Video sidebar ── */}
        {briefenVideos && briefenVideos.length > 0 && (
          <aside className="hidden lg:block w-60 flex-shrink-0 sticky top-22">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-4">
              Vídeos analisados
            </p>
            <div className="space-y-3">
              {briefenVideos.map((bv) =>
                bv.videos ? (
                  <a
                    key={bv.video_id}
                    href={`https://youtube.com/watch?v=${bv.videos.youtube_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-2 group"
                  >
                    {bv.videos.thumbnail_url && (
                      <img
                        src={bv.videos.thumbnail_url}
                        alt=""
                        className="w-16 h-9 rounded object-cover flex-shrink-0"
                      />
                    )}
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground group-hover:text-foreground transition-colors line-clamp-2 leading-snug">
                        {bv.videos.title}
                      </p>
                      {bv.views_at_briefen != null && (
                        <p className="text-xs text-muted-foreground/60 mt-0.5">
                          {formatNumber(bv.views_at_briefen)} views
                        </p>
                      )}
                    </div>
                  </a>
                ) : null
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
