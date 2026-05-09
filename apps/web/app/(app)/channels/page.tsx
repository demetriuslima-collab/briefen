import { createServerClient } from "@/lib/supabase/server";
import { ChannelCard } from "@/components/channels/channel-card";
import { AddChannelButton } from "@/components/channels/add-channel-button";
import type { Channel } from "@/lib/types";

type ChannelRow = Channel & {
  videos: Array<{ count: number }> | null;
};

export default async function ChannelsPage() {
  const supabase = await createServerClient();

  const { data: channels } = await supabase
    .from("channels")
    .select("*, videos(count)")
    .order("created_at", { ascending: false })
    .returns<ChannelRow[]>();

  const isEmpty = !channels || channels.length === 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-xl font-medium text-foreground">Canais</h1>
        <AddChannelButton variant="header" />
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-sm text-muted-foreground max-w-xs">
            Nenhum canal por aqui ainda. Adicione o primeiro para começar a
            briefar.
          </p>
          <AddChannelButton variant="empty" />
        </div>
      ) : (
        <div className="space-y-2">
          {channels.map((ch) => (
            <ChannelCard
              key={ch.id}
              channel={{
                ...ch,
                video_count: ch.videos?.[0]?.count ?? 0,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
