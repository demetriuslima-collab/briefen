"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, ChevronUp, ChevronDown } from "lucide-react";
import {
  formatNumber,
  formatDuration,
  relativeTime,
  viewsPerDay,
} from "@/lib/formatters";
import type { VideoWithStatus } from "@/lib/types";

type SortKey = "views" | "views_per_day" | "likes" | "duration_seconds" | "published_at";
type SortDir = "desc" | "asc";

const SORTABLE_COLS: { key: SortKey; label: string }[] = [
  { key: "views", label: "Views" },
  { key: "views_per_day", label: "Views/dia" },
  { key: "likes", label: "Likes" },
  { key: "duration_seconds", label: "Duração" },
  { key: "published_at", label: "Publicado" },
];

export function VideoTable({ videos }: { videos: VideoWithStatus[] }) {
  const [sort, setSort] = useState<SortKey>("published_at");
  const [dir, setDir] = useState<SortDir>("desc");
  const [search, setSearch] = useState("");

  function handleSort(key: SortKey) {
    if (sort === key) {
      setDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSort(key);
      setDir("desc");
    }
  }

  const filtered = search
    ? videos.filter((v) =>
        v.title.toLowerCase().includes(search.toLowerCase())
      )
    : videos;

  const sorted = [...filtered].sort((a, b) => {
    let diff = 0;
    switch (sort) {
      case "views":
        diff = b.views - a.views;
        break;
      case "views_per_day":
        diff =
          viewsPerDay(b.views, b.published_at) -
          viewsPerDay(a.views, a.published_at);
        break;
      case "likes":
        diff = b.likes - a.likes;
        break;
      case "duration_seconds":
        diff = (b.duration_seconds ?? 0) - (a.duration_seconds ?? 0);
        break;
      case "published_at":
        diff =
          new Date(b.published_at).getTime() -
          new Date(a.published_at).getTime();
        break;
    }
    return dir === "desc" ? diff : -diff;
  });

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <input
          type="text"
          placeholder="Buscar por título..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground max-w-xs"
        />
        <span className="text-xs text-muted-foreground">
          {sorted.length} vídeos
        </span>
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                Vídeo
              </th>
              {SORTABLE_COLS.map((col) => (
                <th key={col.key} className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleSort(col.key)}
                    className={`inline-flex items-center gap-0.5 text-xs font-medium transition-colors ${
                      sort === col.key
                        ? "text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {col.label}
                    {sort === col.key ? (
                      dir === "desc" ? (
                        <ChevronDown size={12} strokeWidth={2} />
                      ) : (
                        <ChevronUp size={12} strokeWidth={2} />
                      )
                    ) : (
                      <ChevronDown size={12} strokeWidth={1.5} className="opacity-30" />
                    )}
                  </button>
                </th>
              ))}
              <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">
                T/R
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((video, i) => (
              <VideoRow
                key={video.id}
                video={video}
                isLast={i === sorted.length - 1}
              />
            ))}
          </tbody>
        </table>

        {sorted.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Nenhum vídeo encontrado.
          </p>
        )}
      </div>
    </div>
  );
}

function VideoRow({
  video,
  isLast,
}: {
  video: VideoWithStatus;
  isLast: boolean;
}) {
  const hasTranscript = video.transcripts !== null;
  const hasSummary = video.summaries !== null;
  const vpd = viewsPerDay(video.views, video.published_at);

  return (
    <tr className={!isLast ? "border-b border-border" : ""}>
      <td className="px-4 py-3">
        <div className="flex items-start gap-3 max-w-lg">
          {video.thumbnail_url && (
            <img
              src={video.thumbnail_url}
              alt=""
              className="w-16 h-9 rounded object-cover flex-shrink-0 mt-0.5"
            />
          )}
          <div className="flex items-start gap-1.5 min-w-0">
            <Link
              href={`/videos/${video.id}`}
              className="text-sm text-foreground hover:text-primary transition-colors line-clamp-2 leading-snug"
            >
              {video.title}
            </Link>
            <a
              href={`https://youtube.com/watch?v=${video.youtube_id}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Abrir no YouTube"
              className="flex-shrink-0 mt-0.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink size={11} strokeWidth={1.5} />
            </a>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-right text-sm text-muted-foreground tabular-nums">
        {formatNumber(video.views)}
      </td>
      <td className="px-4 py-3 text-right text-sm text-muted-foreground tabular-nums">
        {formatNumber(vpd)}
      </td>
      <td className="px-4 py-3 text-right text-sm text-muted-foreground tabular-nums">
        {formatNumber(video.likes)}
      </td>
      <td className="px-4 py-3 text-right text-sm text-muted-foreground tabular-nums">
        {formatDuration(video.duration_seconds)}
      </td>
      <td className="px-4 py-3 text-right text-sm text-muted-foreground">
        {relativeTime(video.published_at)}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-center gap-1.5">
          <span
            className={`w-1.5 h-1.5 rounded-full ${hasTranscript ? "bg-primary" : "bg-border"}`}
            title="Transcrição"
          />
          <span
            className={`w-1.5 h-1.5 rounded-full ${hasSummary ? "bg-primary" : "bg-border"}`}
            title="Resumo"
          />
        </div>
      </td>
    </tr>
  );
}
