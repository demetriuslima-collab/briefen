import Link from "next/link";
import type { ICP } from "@/lib/types";

export function ICPCard({ icp }: { icp: ICP }) {
  return (
    <Link href={`/icps/${icp.id}`} className="block group">
      <div
        className="p-5 bg-card border border-border rounded-lg group-hover:border-[#D4D2CC] transition-colors"
        style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}
      >
        <h2 className="text-sm font-medium text-foreground">{icp.name}</h2>
        <p className="mt-1 text-sm text-muted-foreground line-clamp-2 leading-relaxed">
          {icp.description}
        </p>
        <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
          {icp.pain_points.length > 0 && (
            <span>{icp.pain_points.length} dor{icp.pain_points.length > 1 ? "es" : ""}</span>
          )}
          {icp.goals.length > 0 && (
            <span>{icp.goals.length} objetivo{icp.goals.length > 1 ? "s" : ""}</span>
          )}
          {icp.language_style && <span>Estilo definido</span>}
        </div>
      </div>
    </Link>
  );
}
