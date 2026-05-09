import Link from "next/link";
import { Plus } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { BriefenCard } from "@/components/briefens/briefen-card";
import type { Briefen } from "@/lib/types";

type BriefenRow = Briefen & {
  icps: { name: string } | null;
  channel_count: number;
};

export default async function BriefensPage() {
  const supabase = await createServerClient();

  const { data: briefens } = await supabase
    .from("briefens")
    .select("*, icps(name)")
    .order("created_at", { ascending: false })
    .returns<BriefenRow[]>();

  const isEmpty = !briefens || briefens.length === 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-xl font-medium text-foreground">Briefens</h1>
        <Link
          href="/briefens/new"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity"
        >
          <Plus size={16} strokeWidth={1.5} />
          Novo briefen
        </Link>
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-sm text-muted-foreground max-w-xs">
            Nenhum briefen rodado. Crie um ICP e selecione canais para gerar o
            primeiro.
          </p>
          <Link
            href="/briefens/new"
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity"
          >
            <Plus size={16} strokeWidth={1.5} />
            Novo briefen
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {briefens.map((b) => (
            <BriefenCard key={b.id} briefen={b} />
          ))}
        </div>
      )}
    </div>
  );
}
