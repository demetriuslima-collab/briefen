import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { VideoTable } from "@/components/channels/video-table";
import { SyncButton } from "@/components/channels/sync-button";
import { ChannelSyncStatus } from "@/components/channels/channel-sync-status";
import { formatNumber, relativeTime } from "@/lib/formatters";
import type { Channel, VideoWithStatus } from "@/lib/types";

export default async function ChannelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerClient();

  const { data: channel } = await supabase
    .from("channels")
    .select("*")
    .eq("id", id)
    .single<Channel>();

  if (!channel) notFound();

  const { data: videos } = await supabase
    .from("videos")
    .select("*, transcripts(video_id), summaries(video_id)")
    .eq("channel_id", id)
    .order("views", { ascending: false })
    .limit(200)
    .returns<VideoWithStatus[]>();

  const subs = channel.subscribers ? formatNumber(channel.subscribers) : null;
  const lastSync = channel.last_synced_at
    ? relativeTime(channel.last_synced_at)
    : null;

  return (
    <div>
      {/* Channel header */}
      <div className="flex items-start gap-5 mb-8 pb-8 border-b border-border">
        {channel.thumbnail_url ? (
          <img
            src={channel.thumbnail_url}
            alt=""
            className="w-16 h-16 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-muted flex-shrink-0" />
        )}

        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-medium text-foreground truncate">
            {channel.name}
          </h1>
          {channel.handle && (
            <p className="mt-0.5 text-sm text-muted-foreground">
              @{channel.handle}
            </p>
          )}
          <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
            {subs && <span>{subs} inscritos</span>}
            {videos && <span>{videos.length} vídeos sincronizados</span>}
            {channel.total_videos && (
              <span>{formatNumber(channel.total_videos)} no canal</span>
            )}
            {lastSync && <span>Sincronizado {lastSync}</span>}
          </div>
        </div>

        <SyncButton channelId={channel.id} />
      </div>

      <ChannelSyncStatus channelId={channel.id} />

      {/* Video table */}
      {videos && videos.length > 0 ? (
        <VideoTable videos={videos} />
      ) : (
        <div className="py-16 text-center text-sm text-muted-foreground">
          Nenhum vídeo sincronizado ainda.
        </div>
      )}
    </div>
  );
}
