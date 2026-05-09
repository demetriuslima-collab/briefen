"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatNumber } from "@/lib/formatters";
import type { ICP, Channel } from "@/lib/types";

type Step = 1 | 2 | 3;

const RANKING_OPTIONS = [
  { value: "views_per_day", label: "Views por dia" },
  { value: "views", label: "Views total" },
  { value: "likes", label: "Likes" },
];

export function BriefenWizard({
  icps,
  channels,
}: {
  icps: ICP[];
  channels: Channel[];
}) {
  const [step, setStep] = useState<Step>(1);
  const [icpId, setIcpId] = useState<string | null>(null);
  const [channelIds, setChannelIds] = useState<string[]>([]);
  const [topN, setTopN] = useState(30);
  const [rankingMetric, setRankingMetric] = useState("views_per_day");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const supabase = createClient();

  function toggleChannel(id: string) {
    setChannelIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }

  async function handleGenerate() {
    if (!icpId || channelIds.length === 0) return;
    setLoading(true);
    setError(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada.");

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/briefens`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          icp_id: icpId,
          channel_ids: channelIds,
          top_n_per_channel: topN,
          ranking_metric: rankingMetric,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail ?? "Erro ao criar briefen.");
      }

      const briefen = await res.json();
      router.push(`/briefens/${briefen.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro desconhecido.");
      setLoading(false);
    }
  }

  const selectedICP = icps.find((i) => i.id === icpId);

  return (
    <div className="max-w-2xl">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {([1, 2, 3] as Step[]).map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                step === s
                  ? "bg-primary text-primary-foreground"
                  : step > s
                  ? "bg-primary/15 text-primary"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {step > s ? <Check size={12} strokeWidth={2} /> : s}
            </div>
            {s < 3 && (
              <div
                className={`h-px w-8 transition-colors ${step > s ? "bg-primary/30" : "bg-border"}`}
              />
            )}
          </div>
        ))}
        <span className="ml-2 text-sm text-muted-foreground">
          {step === 1
            ? "Selecionar ICP"
            : step === 2
            ? "Selecionar canais"
            : "Configurar"}
        </span>
      </div>

      {/* ── Step 1: ICP ── */}
      {step === 1 && (
        <div>
          <h2 className="text-sm font-medium text-foreground mb-4">
            Selecione o ICP para este briefen
          </h2>
          <div className="space-y-2">
            {icps.map((icp) => (
              <button
                key={icp.id}
                type="button"
                onClick={() => setIcpId(icp.id)}
                className={`w-full text-left p-4 rounded-lg border transition-colors ${
                  icpId === icp.id
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:border-[#D4D2CC]"
                }`}
              >
                <p className="text-sm font-medium text-foreground">{icp.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                  {icp.description}
                </p>
              </button>
            ))}
          </div>
          <div className="mt-6">
            <button
              onClick={() => setStep(2)}
              disabled={!icpId}
              className="px-5 py-2.5 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              Próximo
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Channels ── */}
      {step === 2 && (
        <div>
          <h2 className="text-sm font-medium text-foreground mb-4">
            Selecione os canais a analisar
          </h2>
          <div className="space-y-2">
            {channels.map((ch) => (
              <button
                key={ch.id}
                type="button"
                onClick={() => toggleChannel(ch.id)}
                className={`w-full text-left flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                  channelIds.includes(ch.id)
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:border-[#D4D2CC]"
                }`}
              >
                {ch.thumbnail_url && (
                  <img
                    src={ch.thumbnail_url}
                    alt=""
                    className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{ch.name}</p>
                  {ch.subscribers && (
                    <p className="text-xs text-muted-foreground">
                      {formatNumber(ch.subscribers)} inscritos
                    </p>
                  )}
                </div>
                {channelIds.includes(ch.id) && (
                  <Check
                    size={14}
                    strokeWidth={1.5}
                    className="flex-shrink-0 text-primary"
                  />
                )}
              </button>
            ))}
          </div>
          <div className="mt-6 flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2.5 text-sm border border-border rounded-md hover:bg-muted transition-colors"
            >
              Voltar
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={channelIds.length === 0}
              className="px-5 py-2.5 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              Próximo
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Configure ── */}
      {step === 3 && (
        <div>
          <h2 className="text-sm font-medium text-foreground mb-6">
            Configurar e gerar
          </h2>
          <div className="space-y-5">
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">
                Top N vídeos por canal
              </label>
              <input
                type="number"
                min={5}
                max={100}
                value={topN}
                onChange={(e) => setTopN(Math.min(100, Math.max(5, Number(e.target.value))))}
                className="w-28 px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">
                Ordenar vídeos por
              </label>
              <select
                value={rankingMetric}
                onChange={(e) => setRankingMetric(e.target.value)}
                className="px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {RANKING_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Summary card */}
            <div className="p-4 bg-muted/50 border border-border rounded-lg text-xs text-muted-foreground space-y-1.5">
              <p>
                ICP:{" "}
                <span className="text-foreground font-medium">
                  {selectedICP?.name}
                </span>
              </p>
              <p>
                {channelIds.length} canal
                {channelIds.length !== 1 ? "is" : ""} selecionado
                {channelIds.length !== 1 ? "s" : ""}
              </p>
              <p>
                Top {topN} vídeos por canal, ordenados por{" "}
                {RANKING_OPTIONS.find((o) => o.value === rankingMetric)?.label.toLowerCase()}
              </p>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={() => setStep(2)}
              disabled={loading}
              className="px-4 py-2.5 text-sm border border-border rounded-md hover:bg-muted transition-colors disabled:opacity-50"
            >
              Voltar
            </button>
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="px-5 py-2.5 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? "Criando..." : "Gerar briefen"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
