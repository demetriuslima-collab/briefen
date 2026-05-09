"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function BriefenPending({ briefenId }: { briefenId: string }) {
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const channel = supabase
      .channel(`briefen-${briefenId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "briefens",
          filter: `id=eq.${briefenId}`,
        },
        (payload) => {
          const s = (payload.new as { status: string }).status;
          if (s === "completed" || s === "failed") {
            router.refresh();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [briefenId]);

  return (
    <div className="py-16 flex flex-col items-center gap-3 text-center">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
        Gerando briefen...
      </div>
      <p className="text-xs text-muted-foreground max-w-xs">
        Isso pode levar alguns minutos. A página atualiza automaticamente quando estiver pronto.
      </p>
    </div>
  );
}
