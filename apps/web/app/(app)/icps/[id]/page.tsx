import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { ICPForm } from "@/components/icps/icp-form";
import type { ICP } from "@/lib/types";

export default async function EditICPPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerClient();

  const { data: icp } = await supabase
    .from("icps")
    .select("*")
    .eq("id", id)
    .single<ICP>();

  if (!icp) notFound();

  return (
    <div>
      <Link
        href="/icps"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ChevronLeft size={14} strokeWidth={1.5} />
        ICPs
      </Link>

      <h1 className="text-xl font-medium text-foreground mb-8">{icp.name}</h1>

      <ICPForm icp={icp} />
    </div>
  );
}
