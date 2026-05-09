import Link from "next/link";
import { relativeTime } from "@/lib/formatters";
import type { Briefen } from "@/lib/types";

type BriefenWithMeta = Briefen & {
  icps: { name: string } | null;
  channel_count?: number;
  icp_name?: string;
};

export function BriefenCard({ briefen }: { briefen: BriefenWithMeta }) {
  const icpName = briefen.icps?.name ?? briefen.icp_name ?? "";
  const channelCount =
    briefen.channel_count ?? briefen.selected_channel_ids?.length ?? 0;

  return (
    <Link href={`/briefens/${briefen.id}`} className="block group">
      <div
        className="flex items-center justify-between gap-4 px-5 py-4 bg-card border border-border rounded-lg group-hover:border-[#D4D2CC] transition-colors"
        style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}
      >
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {briefen.title ?? "Briefen"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {[
              icpName,
              channelCount > 0
                ? `${channelCount} canal${channelCount !== 1 ? "is" : ""}`
                : null,
              relativeTime(briefen.created_at),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <StatusPill status={briefen.status} />
      </div>
    </Link>
  );
}

function StatusPill({ status }: { status: Briefen["status"] }) {
  const map = {
    pending:   { label: "Aguardando", dot: "bg-muted-foreground", text: "text-muted-foreground", pulse: false },
    running:   { label: "Gerando...", dot: "bg-primary",          text: "text-primary",          pulse: true  },
    completed: { label: "Pronto",     dot: "bg-primary",          text: "text-primary",          pulse: false },
    failed:    { label: "Falhou",     dot: "bg-destructive",      text: "text-destructive",      pulse: false },
  }[status] ?? { label: status, dot: "bg-muted-foreground", text: "text-muted-foreground", pulse: false };

  return (
    <div className={`flex items-center gap-1.5 text-xs flex-shrink-0 ${map.text}`}>
      <span
        className={`w-1.5 h-1.5 rounded-full ${map.dot} ${map.pulse ? "animate-pulse" : ""}`}
      />
      {map.label}
    </div>
  );
}
