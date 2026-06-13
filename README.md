# LaNote

Learning companion for PRONOTE — see [AGENTS.md](./AGENTS.md).

## Setup

```bash
pnpm install
cp apps/server/.env.example apps/server/.env
# Apply supabase/migrations to your Supabase project, then fill .env
pnpm dev
```

Open http://localhost:5173 — demo PRONOTE credentials are documented on [index-education demo](https://demo.index-education.net/pronote/).
