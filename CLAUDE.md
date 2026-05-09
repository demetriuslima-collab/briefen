# briefen

Plataforma de inteligência competitiva editorial para criadores do YouTube. Permite cadastrar canais concorrentes, sincronizar métricas e transcrições, criar ICPs e gerar análises estratégicas (briefens) com IA.

## Estrutura do repositório

```
briefen/
├── apps/
│   ├── web/          # Next.js 15 App Router — porta 3001 local
│   └── api/          # FastAPI + worker Python — porta 8000 local
└── supabase/
    └── migrations/   # 0001_initial.sql, 0002_fixes.sql
```

## Como subir localmente

**Terminal 1 — API:**
```bash
cd apps/api
python3.11 -m uvicorn app.main:app --reload --port 8000
```

**Terminal 2 — Worker:**
```bash
cd apps/api
python3.11 -m app.worker
```

**Terminal 3 — Frontend:**
```bash
cd apps/web
npm run dev -- -p 3001
```

## Stack

- **Frontend:** Next.js 15, TypeScript, Tailwind v4, shadcn/ui (tokens customizados)
- **Backend:** FastAPI, asyncpg, Python 3.11
- **Banco:** Supabase Postgres + Auth + Realtime
- **IA:** Groq Llama 3.3 70B (resumos), Claude claude-sonnet-4-6 (briefens), Claude claude-haiku-4-5-20251001 (extração ICP), Whisper via Groq (transcrição fallback)
- **Jobs:** Tabela `jobs` com `SKIP LOCKED` — sem Redis

## Identidade visual

- **Wordmark:** `briefen` em minúsculas, Source Serif 4 weight 600
- **UI:** Inter weight 400/500, nunca 600+
- **Conteúdo longo:** Source Serif 4 weight 400, line-height 1.7
- **Accent:** `#2E5D4F` (British Racing Green), dark mode `#6FAB95`
- **Background:** `#FAFAF7` (off-white quente), dark `#161614`
- **Sem gradientes, sem glassmorphism, sem emojis, sem badges "AI-powered"**
- **Ícones:** Lucide React, stroke 1.5, 16–20px

## Arquitetura de dados

- Reads: Next.js server components → Supabase JS direto (RLS com JWT do usuário)
- Writes complexos: Next.js client → FastAPI → Supabase
- Auth: JWT validado pela API do Supabase (`/auth/v1/user`) — não pelo secret local

## Pipeline de jobs

```
sync_channel → transcribe_video → summarize_video
run_briefen (independente)
```

- `transcribe_video`: tenta youtube-transcript-api (pt → en), fallback Whisper via Groq
- `summarize_video`: Groq Llama 3.3 70B com retry manual em 429 (15s → 30s → 60s)
- Jobs espaçados 12s ao enfileirar para respeitar rate limit do Groq
- Reprocessar vídeos sem transcrição: SQL em `supabase/migrations/` ou via dashboard

## Convenções de domínio

- A análise estratégica se chama **briefen** (não "análise") em todo lugar: tabela, rota, componente
- `POST /briefens` cria um briefen, `GET /briefens/{id}` retorna o resultado
- Nunca usar travessões (—) em copy. Nunca "vale destacar", "é importante notar"

## Deploy de produção

- **Frontend:** Vercel — `https://briefen.vercel.app`
- **API:** Railway — `https://briefen-production.up.railway.app` (porta 8080)
- **Worker:** Railway — serviço separado, mesmo repo, CMD `python -m app.worker`
- **Supabase:** projeto `ssgrmwuuvxlgqdpkexpu`, região `sa-east-1` (São Paulo)

## Variáveis de ambiente

**Vercel (frontend)**
```
NEXT_PUBLIC_SUPABASE_URL=https://ssgrmwuuvxlgqdpkexpu.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...   # anon public (legacy), NÃO a publishable key sb_publishable_...
NEXT_PUBLIC_API_URL=https://briefen-production.up.railway.app   # sem barra no final
```

**`apps/web/.env.local` (local)**
```
NEXT_PUBLIC_SUPABASE_URL=https://ssgrmwuuvxlgqdpkexpu.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_API_URL=http://localhost:8000
```

**Railway (API)**
```
SUPABASE_URL=https://ssgrmwuuvxlgqdpkexpu.supabase.co
SUPABASE_SERVICE_KEY=...
SUPABASE_JWT_SECRET=...
DATABASE_URL=postgresql://postgres.ssgrmwuuvxlgqdpkexpu:[SENHA_ENCODED]@aws-1-sa-east-1.pooler.supabase.com:6543/postgres
YOUTUBE_API_KEY=...
GROQ_API_KEY=...
ANTHROPIC_API_KEY=...
CORS_ORIGINS=["https://briefen.vercel.app"]
```

**`apps/api/.env` (local)**
```
SUPABASE_URL=https://ssgrmwuuvxlgqdpkexpu.supabase.co
SUPABASE_SERVICE_KEY=...
SUPABASE_JWT_SECRET=...
DATABASE_URL=postgresql://postgres:...@db.ssgrmwuuvxlgqdpkexpu.supabase.co:5432/postgres
YOUTUBE_API_KEY=...
GROQ_API_KEY=...
ANTHROPIC_API_KEY=...
CORS_ORIGINS=["http://localhost:3001"]
```

## Armadilhas conhecidas

- `SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_URL` devem ser sem o prefixo `db.`
- O uvicorn `--reload` não relê `.env` — matar e subir de novo quando mudar variáveis
- `executemany` do asyncpg com `ON CONFLICT` pode silenciar erros — usar `execute` em loop
- Groq Whisper API tem limite de 25 MB por arquivo — usar 32kbps para vídeos longos
- Jobs de resumo e transcrição precisam de retry manual em 429 (o SDK não faz retry em áudio)
- `on_auth_user_created` trigger precisa de `SET search_path = public` no Supabase
- Thumbnail do YouTube pode retornar 429 em desenvolvimento — normal, passa em produção
- `DATABASE_URL` em produção deve usar o **Transaction Pooler** (porta 6543), não conexão direta (porta 5432 usa IPv6, incompatível com Railway)
- Senha da DATABASE_URL deve ter caracteres especiais URL-encoded: `python3 -c 'import urllib.parse; print(urllib.parse.quote(input(), safe=""))' <<< 'SENHA'`
- `NEXT_PUBLIC_API_URL` no Vercel deve ser **sem barra no final** — barra dupla (`//channels`) causa 404
- Supabase passou a ter novo formato de chave (`sb_publishable_...`) — usar a legacy **anon public** (`eyJ...`) no `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Pool de conexão DB é criado lazily na primeira requisição (sem startup connection) — primeira request após deploy é mais lenta
- Circuit breaker do Supabase pooler bloqueia novas conexões após muitas falhas de auth — parar o serviço e aguardar 5-10min para resetar

## Supabase

- Rodar `0001_initial.sql` e `0002_fixes.sql` no SQL Editor ao criar o projeto
- Ativar Google OAuth em Authentication → Providers → Google
- URL Configuration: Site URL `https://briefen.vercel.app`, Redirect URLs `https://briefen.vercel.app/**`
- Realtime habilitado para `jobs` e `briefens` via `0002_fixes.sql`
