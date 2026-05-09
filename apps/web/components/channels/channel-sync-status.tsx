"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function ChannelSyncStatus({ channelId }: { channelId: string }) {
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const channel = supabase
      .channel(`sync-${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "jobs",
          filter: `type=eq.sync_channel`,
        },
        (payload) => {
          const job = payload.new as { status: string; payload: Record<string, string> };
          const isThisChannel =
            job.payload?.channel_id === channelId ||
            String(job.payload?.channel_id) === channelId;

          if (
            isThisChannel &&
            (job.status === "completed" || job.status === "failed")
          ) {
            router.refresh();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId]);

  return null;
}
