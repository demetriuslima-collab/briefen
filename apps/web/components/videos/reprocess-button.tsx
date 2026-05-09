"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function ReprocessButton({ videoId }: { videoId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleReprocess() {
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/videos/${videoId}/reprocess`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      );
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleReprocess}
      disabled={loading}
      className="inline-flex items-center justify-center gap-2 px-3 py-2 text-xs border border-border rounded-md text-muted-foreground hover:text-foreground hover:border-[#D4D2CC] transition-colors disabled:opacity-50"
    >
      <RefreshCw
        size={12}
        strokeWidth={1.5}
        className={loading ? "animate-spin" : ""}
      />
      {loading ? "Enfileirando..." : "Reprocessar"}
    </button>
  );
}
