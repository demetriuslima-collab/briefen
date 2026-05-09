import Link from "next/link";
import { Plus } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { ICPCard } from "@/components/icps/icp-card";
import type { ICP } from "@/lib/types";

export default async function ICPsPage() {
  const supabase = await createServerClient();

  const { data: icps } = await supabase
    .from("icps")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<ICP[]>();

  const isEmpty = !icps || icps.length === 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-xl font-medium text-foreground">ICPs</h1>
        <Link
          href="/icps/new"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity"
        >
          <Plus size={16} strokeWidth={1.5} />
          Novo ICP
        </Link>
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-sm text-muted-foreground max-w-xs">
            Nenhum ICP cadastrado. Defina o perfil de cliente ideal para gerar
            briefens relevantes.
          </p>
          <Link
            href="/icps/new"
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity"
          >
            <Plus size={16} strokeWidth={1.5} />
            Novo ICP
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {icps.map((icp) => (
            <ICPCard key={icp.id} icp={icp} />
          ))}
        </div>
      )}
    </div>
  );
}
