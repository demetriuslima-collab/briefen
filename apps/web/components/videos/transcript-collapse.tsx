"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

export function TranscriptCollapse({
  content,
  wordCount,
  source,
}: {
  content: string;
  wordCount?: number | null;
  source?: string | null;
}) {
  const [open, setOpen] = useState(false);

  const sourceLabel =
    source === "whisper_groq"
      ? "Whisper"
      : source === "youtube_auto"
      ? "YouTube auto"
      : null;

  return (
    <div className="mt-10 pt-6 border-t border-border">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronDown
          size={14}
          strokeWidth={1.5}
          className={`transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
        {open ? "Ocultar transcrição" : "Ver transcrição completa"}
        {!open && (wordCount || sourceLabel) && (
          <span className="text-muted-foreground/50">
            {[
              wordCount ? `${wordCount.toLocaleString("pt-BR")} palavras` : null,
              sourceLabel,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        )}
      </button>

      {open && (
        <div className="mt-4 max-h-96 overflow-y-auto rounded-lg bg-muted/30 px-4 py-4 text-sm text-muted-foreground leading-relaxed">
          {content}
        </div>
      )}
    </div>
  );
}
