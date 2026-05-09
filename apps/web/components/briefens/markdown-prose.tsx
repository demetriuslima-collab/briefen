"use client";

import ReactMarkdown from "react-markdown";

export function MarkdownProse({ content }: { content: string }) {
  return (
    <div className="prose-briefen">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}
