import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ICPForm } from "@/components/icps/icp-form";

export default function NewICPPage() {
  return (
    <div>
      <Link
        href="/icps"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ChevronLeft size={14} strokeWidth={1.5} />
        ICPs
      </Link>

      <h1 className="text-xl font-medium text-foreground mb-8">Novo ICP</h1>

      <ICPForm />
    </div>
  );
}
