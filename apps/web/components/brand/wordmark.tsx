import { cn } from "@/lib/utils";

interface WordmarkProps {
  className?: string;
}

export function Wordmark({ className }: WordmarkProps) {
  return (
    <span
      className={cn(
        "font-serif font-semibold tracking-[0.01em] text-foreground lowercase select-none",
        className
      )}
    >
      briefen
    </span>
  );
}
