import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { NavLink } from "@/components/nav-link";
import { JobStatusIndicator } from "@/components/job-status";
import { ThemeToggle } from "@/components/theme-toggle";

const nav = [
  { href: "/channels", label: "Canais" },
  { href: "/icps", label: "ICPs" },
  { href: "/briefens", label: "Briefens" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header
        className="border-b border-border bg-card sticky top-0 z-10"
        style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}
      >
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/channels">
            <Wordmark className="text-lg" />
          </Link>

          <div className="flex items-center gap-6">
            <JobStatusIndicator />
            <nav className="flex items-center gap-6">
              {nav.map((item) => (
                <NavLink key={item.href} href={item.href} label={item.label} />
              ))}
            </nav>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
