import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { BriefenWizard } from "@/components/briefens/briefen-wizard";
import type { ICP, Channel } from "@/lib/types";

export default async function NewBriefen() {
  const supabase = await createServerClient();

  const [{ data: icps }, { data: channels }] = await Promise.all([
    supabase.from("icps").select("*").order("created_at", { ascending: false }).returns<ICP[]>(),
    supabase.from("channels").select("*").order("name").returns<Channel[]>(),
  ]);

  return (
    <div>
      <Link
        href="/briefens"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ChevronLeft size={14} strokeWidth={1.5} />
        Briefens
      </Link>

      <h1 className="text-xl font-medium text-foreground mb-8">Novo briefen</h1>

      {!icps?.length ? (
        <p className="text-sm text-muted-foreground">
          <Link href="/icps/new" className="text-primary hover:underline">
            Crie um ICP
          </Link>{" "}
          antes de gerar um briefen.
        </p>
      ) : !channels?.length ? (
        <p className="text-sm text-muted-foreground">
          <Link href="/channels" className="text-primary hover:underline">
            Adicione um canal
          </Link>{" "}
          antes de gerar um briefen.
        </p>
      ) : (
        <BriefenWizard icps={icps} channels={channels} />
      )}
    </div>
  );
}
