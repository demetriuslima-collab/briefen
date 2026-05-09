"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Upload, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { ICP } from "@/lib/types";

interface ICPFormProps {
  icp?: ICP;
}

export function ICPForm({ icp }: ICPFormProps) {
  const [name, setName] = useState(icp?.name ?? "");
  const [description, setDescription] = useState(icp?.description ?? "");
  const [painPoints, setPainPoints] = useState<string[]>(icp?.pain_points ?? []);
  const [goals, setGoals] = useState<string[]>(icp?.goals ?? []);
  const [languageStyle, setLanguageStyle] = useState(icp?.language_style ?? "");
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [importedFileName, setImportedFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const supabase = createClient();

  async function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setExtracting(true);
    setError(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada.");

      const form = new FormData();
      form.append("file", file);

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/icps/extract`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: form,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail ?? "Erro ao processar o documento.");
      }

      const extracted = await res.json();
      if (extracted.name) setName(extracted.name);
      if (extracted.description) setDescription(extracted.description);
      if (Array.isArray(extracted.pain_points)) setPainPoints(extracted.pain_points);
      if (Array.isArray(extracted.goals)) setGoals(extracted.goals);
      if (extracted.language_style) setLanguageStyle(extracted.language_style);
      setImportedFileName(file.name);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro desconhecido.");
    } finally {
      setExtracting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada. Faça login novamente.");

      const body = {
        name,
        description,
        pain_points: painPoints,
        goals,
        language_style: languageStyle || null,
      };

      const url = icp
        ? `${process.env.NEXT_PUBLIC_API_URL}/icps/${icp.id}`
        : `${process.env.NEXT_PUBLIC_API_URL}/icps`;

      const res = await fetch(url, {
        method: icp ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail ?? "Erro ao salvar ICP.");
      }

      router.push("/icps");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro desconhecido.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl">
      {/* Import section */}
      <div className="mb-8 p-4 border border-border rounded-lg bg-muted/20">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-foreground">
              Importar de documento
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              PDF, DOCX ou TXT. Os campos são preenchidos automaticamente.
            </p>
          </div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={extracting}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-border rounded-md hover:bg-muted transition-colors disabled:opacity-50 flex-shrink-0"
          >
            <Upload size={14} strokeWidth={1.5} />
            {extracting ? "Analisando..." : "Selecionar arquivo"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.docx,.txt"
            onChange={handleFileImport}
            className="hidden"
          />
        </div>

        {importedFileName && !extracting && (
          <div className="mt-3 flex items-center gap-2 text-xs text-primary">
            <FileText size={12} strokeWidth={1.5} />
            <span>Campos preenchidos a partir de <strong>{importedFileName}</strong>. Revise antes de salvar.</span>
          </div>
        )}

      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Field label="Nome">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Ex: Investidor Iniciante"
            className="input-base"
          />
        </Field>

        <Field label="Descrição">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            rows={4}
            placeholder="Quem é esse perfil? O que define esse cliente ideal?"
            className="input-base resize-none"
          />
        </Field>

        <EditableList
          label="Dores"
          items={painPoints}
          onChange={setPainPoints}
          placeholder="Adicionar dor ou frustração..."
        />

        <EditableList
          label="Objetivos"
          items={goals}
          onChange={setGoals}
          placeholder="Adicionar objetivo ou resultado desejado..."
        />

        <Field label="Estilo de linguagem (opcional)">
          <textarea
            value={languageStyle}
            onChange={(e) => setLanguageStyle(e.target.value)}
            rows={2}
            placeholder="Ex: Direto, sem jargões. Prefere exemplos práticos."
            className="input-base resize-none"
          />
        </Field>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? "Salvando..." : icp ? "Salvar alterações" : "Criar ICP"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/icps")}
            className="px-4 py-2.5 text-sm border border-border rounded-md hover:bg-muted transition-colors"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs text-muted-foreground mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function EditableList({
  label,
  items,
  onChange,
  placeholder,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");

  function add() {
    const trimmed = draft.trim();
    if (trimmed) {
      onChange([...items, trimmed]);
      setDraft("");
    }
  }

  function remove(i: number) {
    onChange(items.filter((_, idx) => idx !== i));
  }

  return (
    <Field label={label}>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="flex-1 px-3 py-2 text-sm bg-muted rounded-md text-foreground">
              {item}
            </span>
            <button
              type="button"
              onClick={() => remove(i)}
              className="text-muted-foreground hover:text-destructive transition-colors"
            >
              <X size={14} strokeWidth={1.5} />
            </button>
          </div>
        ))}
        <div className="flex gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder={placeholder}
            className="flex-1 px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
          />
          <button
            type="button"
            onClick={add}
            className="px-3 py-2 border border-border rounded-md hover:bg-muted transition-colors"
          >
            <Plus size={14} strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </Field>
  );
}
