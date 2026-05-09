# briefen

Inteligência competitiva editorial para criadores do YouTube.

## Estrutura

```
briefen/
├── apps/
│   ├── web/          # Next.js 15 — deploy na Vercel
│   └── api/          # FastAPI + worker — deploy no Railway
└── supabase/
    └── migrations/   # Schema do banco
```

## Setup

### Web

```bash
cd apps/web
cp .env.local.example .env.local
# preencha as variáveis
npm install
npm run dev
```

### API

```bash
cd apps/api
cp .env.example .env
# preencha as variáveis
pip install uv
uv pip install -e .
uvicorn app.main:app --reload
```

### Worker (processo separado)

```bash
cd apps/api
python -m app.worker
```

### Supabase

Rode a migration no SQL editor do Supabase:

```
supabase/migrations/0001_initial.sql
```

## Deploy

- **Web**: Vercel, apontar para `apps/web`, variáveis em `.env.local.example`
- **API**: Railway, serviço `briefen-api`, comando `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Worker**: Railway, serviço `briefen-worker`, mesmo Dockerfile, comando `python -m app.worker`

## Fases de implementação

1. **Fase 1** — Esqueleto (atual)
2. **Fase 2** — Auth e workspace
3. **Fase 3** — Canais (CRUD + sync)
4. **Fase 4** — Worker assíncrono
5. **Fase 5** — Transcrição
6. **Fase 6** — Resumo (Groq Llama)
7. **Fase 7** — ICPs
8. **Fase 8** — Briefens (Claude Sonnet)
9. **Fase 9** — Polimento
