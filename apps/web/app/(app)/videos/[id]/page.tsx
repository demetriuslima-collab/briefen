import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { TranscriptCollapse } from "@/components/videos/transcript-collapse";
import { ReprocessButton } from "@/components/videos/reprocess-button";
import { formatNumber, formatDuration, relativeTime } from "@/lib/formatters";
import type { Video } from "@/lib/types";

type VideoPage = Video & {
  channels: { id: string; name: string } | null;
  transcripts: {
    content: string;
    language: string;
    source: string;
    word_count: number | null;
  } | null;
  summaries: {
    summary: string;
    topics: string[];
    hooks: string[];
    model_used: string;
  } | null;
};

export default async function VideoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerClient();

  const { data: video } = await supabase
    .from("videos")
    .select("*, channels(id, name), transcripts(*), summaries(*)")
    .eq("id", id)
    .single<VideoPage>();

  if (!video) notFound();

  const hasTranscript = !!video.transcripts;
  const hasSummary = !!video.summaries;
  const topics: string[] = video.summaries?.topics ?? [];
  const hooks: string[] = video.summaries?.hooks ?? [];

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 mb-6 text-sm text-muted-foreground">
        <Link href="/channels" className="hover:text-foreground transition-colors">
          Canais
        </Link>
        {video.channels && (
          <>
            <ChevronLeft size={14} strokeWidth={1.5} className="rotate-180" />
            <Link
              href={`/channels/${video.channels.id}`}
              className="hover:text-foreground transition-colors"
            >
              {video.channels.name}
            </Link>
          </>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* ── Sidebar: thumbnail + metrics ── */}
        <div className="w-full lg:w-64 flex-shrink-0">
          {video.thumbnail_url ? (
            <img
              src={video.thumbnail_url}
              alt=""
              className="w-full rounded-lg object-cover aspect-video mb-4"
            />
          ) : (
            <div className="w-full aspect-video rounded-lg bg-muted mb-4" />
          )}

          <h1 className="text-sm font-medium text-foreground leading-snug mb-4">
            {video.title}
          </h1>

          <dl className="space-y-2 text-xs">
            <MetricRow label="Views" value={formatNumber(video.views)} />
            <MetricRow label="Likes" value={formatNumber(video.likes)} />
            <MetricRow label="Comentários" value={formatNumber(video.comments)} />
            {video.duration_seconds && (
              <MetricRow
                label="Duração"
                value={formatDuration(video.duration_seconds)}
              />
            )}
            <MetricRow
              label="Publicado"
              value={relativeTime(video.published_at)}
            />
          </dl>

          {/* Status */}
          <div className="mt-4 pt-4 border-t border-border space-y-1.5">
            <StatusRow label="Transcrição" done={hasTranscript} />
            <StatusRow label="Resumo" done={hasSummary} />
          </div>

          {/* Actions */}
          <div className="mt-5 flex flex-col gap-2">
            <a
              href={`https://youtube.com/watch?v=${video.youtube_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-3 py-2 text-xs border border-border rounded-md text-muted-foreground hover:text-foreground hover:border-[#D4D2CC] transition-colors"
            >
              <ExternalLink size={12} strokeWidth={1.5} />
              Abrir no YouTube
            </a>
            <ReprocessButton videoId={video.id} />
          </div>
        </div>


        {/* ── Main: summary + transcript ── */}
        <div className="flex-1 min-w-0">
          {hasSummary ? (
            <div>
              <p className="prose-briefen">{video.summaries!.summary}</p>

              {topics.length > 0 && (
                <div className="mt-6">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Tópicos
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {topics.map((t, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 text-xs bg-muted text-muted-foreground rounded"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {hooks.length > 0 && (
                <div className="mt-5">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Ganchos
                  </p>
                  <ul className="space-y-1.5">
                    {hooks.map((h, i) => (
                      <li key={i} className="text-sm text-muted-foreground">
                        {h}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="py-10 text-sm text-muted-foreground">
              {hasTranscript
                ? "Transcrição disponível. Resumo ainda sendo gerado..."
                : "Transcrição e resumo ainda não disponíveis."}
            </div>
          )}

          {hasTranscript && (
            <TranscriptCollapse
              content={video.transcripts!.content}
              wordCount={video.transcripts!.word_count}
              source={video.transcripts!.source}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground tabular-nums">{value}</dd>
    </div>
  );
}

function StatusRow({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={`flex items-center gap-1 ${done ? "text-primary" : "text-muted-foreground/50"}`}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full ${done ? "bg-primary" : "bg-muted-foreground/30"}`}
        />
        {done ? "Pronto" : "Pendente"}
      </span>
    </div>
  );
}

