"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Wordmark } from "@/components/brand/wordmark";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setError(error.message);
    else setSent(true);
    setLoading(false);
  }

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <Wordmark className="text-2xl" />
          <p className="mt-3 text-sm text-muted-foreground">
            Inteligência competitiva editorial para criadores do YouTube.
          </p>
        </div>

        <div
          className="rounded-lg border border-border bg-card p-6 space-y-4"
          style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}
        >
          {sent ? (
            <p className="text-sm text-center text-foreground py-2">
              Link enviado para <strong>{email}</strong>. Verifique sua caixa de entrada.
            </p>
          ) : (
            <>
              <button
                onClick={handleGoogle}
                className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 text-sm border border-border rounded-md bg-card hover:bg-muted transition-colors"
              >
                <GoogleIcon />
                Entrar com Google
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-card px-2 text-xs text-muted-foreground">ou</span>
                </div>
              </div>

              <form onSubmit={handleMagicLink} className="space-y-3">
                <input
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
                />
                {error && (
                  <p className="text-xs text-destructive">{error}</p>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-4 py-2.5 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {loading ? "Enviando..." : "Enviar link de acesso"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M15.68 8.18c0-.57-.05-1.11-.14-1.64H8v3.1h4.3a3.68 3.68 0 0 1-1.6 2.42v2.01h2.6c1.52-1.4 2.4-3.47 2.4-5.9z" fill="#4285F4" />
      <path d="M8 16c2.16 0 3.97-.72 5.3-1.93l-2.6-2.01c-.71.48-1.63.76-2.7.76-2.08 0-3.84-1.4-4.47-3.3H.86v2.08A8 8 0 0 0 8 16z" fill="#34A853" />
      <path d="M3.53 9.52A4.8 4.8 0 0 1 3.28 8c0-.53.09-1.04.25-1.52V4.4H.86A8 8 0 0 0 0 8c0 1.29.31 2.51.86 3.6l2.67-2.08z" fill="#FBBC05" />
      <path d="M8 3.18c1.17 0 2.22.4 3.05 1.2l2.28-2.28A8 8 0 0 0 8 0 8 8 0 0 0 .86 4.4L3.53 6.48C4.16 4.58 5.92 3.18 8 3.18z" fill="#EA4335" />
    </svg>
  );
}
