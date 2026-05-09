"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function JobStatusIndicator() {
  const [count, setCount] = useState(0);
  const supabase = createClient();

  useEffect(() => {
    let workspaceId: string | null = null;

    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: membership } = await supabase
        .from("workspace_members")
        .select("workspace_id")
        .eq("user_id", user.id)
        .single();

      if (!membership) return;
      workspaceId = membership.workspace_id;

      async function refresh() {
        if (!workspaceId) return;
        const { count: n } = await supabase
          .from("jobs")
          .select("*", { count: "exact", head: true })
          .eq("workspace_id", workspaceId)
          .in("status", ["pending", "running"]);
        setCount(n ?? 0);
      }

      await refresh();

      const channel = supabase
        .channel("jobs-status")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "jobs",
            filter: `workspace_id=eq.${workspaceId}`,
          },
          refresh
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }

    const cleanup = init();
    return () => {
      cleanup.then((fn) => fn?.());
    };
  }, []);

  if (count === 0) return null;

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
      {count === 1 ? "Sincronizando..." : `${count} jobs em andamento`}
    </div>
  );
}
