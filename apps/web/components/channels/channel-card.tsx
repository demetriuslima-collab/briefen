import Link from "next/link";
import { formatNumber, relativeTime } from "@/lib/formatters";
import type { Channel } from "@/lib/types";

interface ChannelCardProps {
  channel: Channel & { video_count?: number };
}

export function ChannelCard({ channel }: ChannelCardProps) {
  const subs = channel.subscribers ? formatNumber(channel.subscribers) : null;
  const syncedCount = channel.video_count ?? 0;
  const lastSync = channel.last_synced_at
    ? relativeTime(channel.last_synced_at)
    : null;

  return (
    <Link href={`/channels/${channel.id}`} className="block group">
      <div
        className="flex items-center gap-4 px-5 py-4 bg-card border border-border rounded-lg group-hover:border-[#D4D2CC] transition-colors"
        style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}
      >
        {channel.thumbnail_url ? (
          <img
            src={channel.thumbnail_url}
            alt=""
            className="w-11 h-11 rounded-full flex-shrink-0 object-cover"
          />
        ) : (
          <div className="w-11 h-11 rounded-full bg-muted flex-shrink-0" />
        )}

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {channel.name}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {[
              subs ? `${subs} inscritos` : null,
              syncedCount > 0 ? `${syncedCount} vídeos sincronizados` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>

        <div className="text-xs text-muted-foreground text-right flex-shrink-0">
          {lastSync ? `Sincronizado ${lastSync}` : "Nunca sincronizado"}
        </div>
      </div>
    </Link>
  );
}
