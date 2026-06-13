# LaNote — Agent Guide

A learning companion app for children, powered by PRONOTE data (grades, *cahier de texte*) and AI (OpenRouter). Official school data remains the source of truth in PRONOTE; Supabase stores only what PRONOTE does not provide.

**When changing product specs, update this file. For architecture details, see [docs/agents/ARCHITECTURE.md](docs/agents/ARCHITECTURE.md).**

---

## Language

| Scope | Language |
|-------|----------|
| **Documentation & specs** | English |
| **Application UI** | **French** — all labels, messages, errors, and AI-generated learner-facing content |
| **Code** | English (identifiers, comments, API routes) |
| **AI prompts** | French output requested; system prompts may be English |

French UI examples used throughout (e.g. *Activités du jour*, *J'ai compris*) reflect the strings to implement in the app. Use `vue-i18n` or `locales/fr.json`; locale fixed to `fr-FR`.

---

## Vision

The learner views their PRONOTE evaluations and *cahier de texte* (course reports), receives tailored **daily activities**, can upload corrected work for an **AI diagnosis** and a **revision plan** based on **spaced repetition** (neuro-learning). They track progress, indicate whether they understood each session, and set their weekly study time budget.

---

## Tech stack

| Layer | Choice | Role |
|-------|--------|------|
| Frontend | **Vue 3 + Vite + TypeScript** | UI, local state, PRONOTE credentials in `localStorage` |
| UI state | **Pinia** | Session, preferences, short-lived cache |
| Routing | **Vue Router** | Step / view navigation |
| Backend | **Hono** (Node.js, TypeScript) | PRONOTE proxy, AI, business logic, secrets |
| PRONOTE | **`@lanote/pronote-api`** (`packages/pronote-api`) | Auth and requests to the school's PRONOTE instance — **vendored in-repo** |
| Package manager | **pnpm** (workspaces) | Monorepo installs and scripts |
| Database | **Supabase** (PostgreSQL only) | PRONOTE proxy sessions, plans, analyses, feedback, budgets — **backend only** |
| AI | **OpenRouter** | Work analysis, activity and plan generation |

### PRONOTE client (`@lanote/pronote-api`)

The upstream npm packages (`pronote-api`, `pronote-api-maintained`, etc.) are **no longer reliably published**. LaNote vendors its own client in `packages/pronote-api`, initially copied from **[Merlode11/pronote-api](https://github.com/Merlode11/pronote-api)** (MIT, fork of EduWireApps/Litarvan).

| Topic | Decision |
|-------|----------|
| **Source** | Import upstream `src/` + entry points; keep attribution and license |
| **Scope** | Library only (no GraphQL server / `bin/` in production path) |
| **LaNote extensions** | `serializeSession` / `restoreSession` so `pronote_sessions.session_data` can hydrate a client on each API request (upstream keeps sessions in memory only) |
| **Usage** | `apps/server` imports `@lanote/pronote-api`; the browser **never** imports it |
| **CAS / ENT** | Optional fourth login argument (`cas`) for regional ENT accounts — same as upstream |

See [docs/agents/ARCHITECTURE.md](docs/agents/ARCHITECTURE.md) for session lifecycle and serialization fields.

### Why a server?

- The PRONOTE protocol ([INDEX ÉDUCATION Service Rest](https://www.index-education.com/fr/serviceRestHP.php#)) is not a documented public REST API; community libraries reverse-engineer the internal protocol and require a server runtime (crypto, sessions, CORS). LaNote uses the vendored `@lanote/pronote-api` package (based on [Merlode11/pronote-api](https://github.com/Merlode11/pronote-api)).
- The **OpenRouter** API key must never be exposed to the browser.
- **Supabase** is accessed **only by the backend** using the **service role key** — the frontend never connects to Supabase (no `@supabase/supabase-js`, no anon key).
- Evaluation copies are sent to the backend API for **transient AI analysis only** — files are **not** persisted.

### “Do not duplicate PRONOTE” principle

| PRONOTE source (fetch on demand, short TTL client cache) | Stored in Supabase |
|----------------------------------------------------------|-------------------|
| Grades / evaluations and averages | AI analyses and detected weaknesses (per `pronote_evaluation_id`) |
| *Cahier de texte* (course session reports) | Spaced-repetition plans |
| Timetable, homework | Per-session “understood / not yet” feedback |
| Learner identity, subjects, periods | Study time budget (minutes per weekday) |
| | PRONOTE proxy session state (serialized, for API continuity — not school records) |

PRONOTE identifiers (`pronote_evaluation_id`, `pronote_period_id`, etc.) are **link keys only**.

---

## Architecture

See **[docs/agents/ARCHITECTURE.md](docs/agents/ARCHITECTURE.md)** for system diagram, API routes, Supabase setup, deployment, and local development.

---

## Supabase data model (overview)

```
learners
  id, pronote_account_hash, display_name, created_at

pronote_sessions
  id, learner_id, session_data (jsonb), expires_at, created_at, updated_at

ai_analyses
  id, learner_id, pronote_evaluation_id, weaknesses (jsonb), summary, model, analyzed_at

learning_plans
  id, learner_id, source_type (daily|evaluation), source_id, status, created_at

plan_sessions
  id, plan_id, scheduled_at, duration_minutes, topic, content (jsonb),
  repetition_interval_days, repetition_level, status (pending|done|reset)

session_feedback
  id, session_id, understood (bool), feedback_at

weekly_time_budget
  id, learner_id, mon..sun minutes, updated_at

daily_activities
  id, learner_id, date, activities (jsonb), source_report_date, created_at
```

---

## Spaced repetition (neuro-learning)

Target algorithm (refine during implementation):

1. **Initial level**: 1-day interval after a weakness is identified.
2. **Success** (`understood = true`): multiply interval (e.g. 1 → 3 → 7 → 14 → 30 days).
3. **Failure** (`understood = false`): **reset** — level 0, next session tomorrow, AI-revised content.
4. **Step 7**: sessions per day capped by minute budget / average session duration.

---

## Roadmap by step

### Step 1 — PRONOTE credentials (localStorage)

**Goal**: Allow the learner to connect to their PRONOTE instance.

**UI (French)**: form (URL, username, password; ENT/CAS if needed); *Tester la connexion*, *Enregistrer*.

**Storage**: `localStorage` key `lanote.pronote.credentials` — **never** Supabase. Stable client UUID for reconnections.

**Backend**: `POST /api/pronote/login`, `POST /api/pronote/logout`
- On login: authenticate via `@lanote/pronote-api` (`loginStudent`), upsert `learners`, persist `serializeSession()` output in `pronote_sessions`, return signed `sessionToken`.
- On each request: verify `sessionToken`, load session from Supabase, `restoreSession()` → proxy PRONOTE → `UPDATE` row if session mutated (e.g. `request` counter).
- On logout: call PRONOTE logout if possible, delete `pronote_sessions` row.

**Acceptance criteria**
- [ ] Successful login displays learner name
- [ ] Credentials persist across reload
- [ ] Clear French error on invalid credentials

---

### Step 2 — Daily grades and *cahier de texte*

**Goal**: Display recent evaluations and course session reports.

**UI (French)**: *Aujourd'hui*, *Cahier de texte*, *Actualiser*.

**Backend**: `GET /api/pronote/evaluations?from=&to=`, `GET /api/pronote/cahier-texte?from=&to=`

**Data**: 100% PRONOTE; optional 5–15 min server cache; no Supabase writes.

**Acceptance criteria**
- [ ] Grades match PRONOTE for current period
- [ ] *Cahier de texte* shows subject, content, date, teacher
- [ ] Empty states handled

---

### Step 3 — Daily activities (*Activités du jour*)

**Goal**: Generate daily learning activities from recent course reports.

**Flow**: fetch last N days of reports → OpenRouter (quiz, exercises, flashcards) → `daily_activities` (no raw PRONOTE text stored).

**UI (French)**: *Activités du jour* card; mark done.

**Backend**: `POST /api/activities/generate`, `GET /api/activities/today`

**Acceptance criteria**
- [ ] Activities reflect recent *cahier de texte*
- [ ] Manual regeneration
- [ ] Only `source_report_date` + generated activities stored

---

### Step 4 — Evaluation analysis + AI planning

**Goal**: Submit work for one-off AI analysis → weaknesses → spaced-repetition plan. The file is **not** stored.

**UI (French)**: *Déposer ma copie*; result screen with calendar.

**Flow**: multipart to backend → OpenRouter vision (in memory) → persist `ai_analyses` + `learning_plan` + `plan_sessions` → discard file.

**Backend**: `POST /api/evaluations/:id/analyze` (multipart), `GET /api/plans/:planId`

**Acceptance criteria**
- [ ] At least one actionable weakness per subject
- [ ] Visible session calendar
- [ ] Grade metadata from PRONOTE only; analysis linked via `pronote_evaluation_id`
- [ ] Evaluation file is not retained after analysis

---

### Step 5 — Per-session feedback

**Goal**: *J'ai compris* / *Pas encore* → advance or reset spaced repetition.

**Backend**: `POST /api/sessions/:sessionId/feedback` `{ understood: boolean }`

**Acceptance criteria**
- [ ] Reset recalculates future sessions
- [ ] Short French explanation when session returns

---

### Step 6 — Track every PRONOTE grade

**Goal**: Badge per evaluation: *Non analysée*, *En analyse*, *Plan actif*, *Terminé*.

**Acceptance criteria**
- [ ] All period evaluations from PRONOTE
- [ ] Accurate analysis/plan status
- [ ] Untreated grade opens Step 4 flow

---

### Step 7 — Weekly study time budget

**Goal**: Minutes per weekday; Step 4 scheduling respects budget.

**Backend**: `GET/PUT /api/learners/me/time-budget`

**Acceptance criteria**
- [ ] Budget change recalculates future sessions (keeps feedback history)
- [ ] 0 min day → no new sessions that day

---

### Step 8 — Scheduled activities interface

**Goal**: Unified *Planning* view — daily activities, plan sessions, spaced-repetition reminders.

**Backend**: `GET /api/schedule?from=&to=`

**Acceptance criteria**
- [ ] Single unified timeline
- [ ] Past sessions show feedback
- [ ] Printable week view (nice-to-have)

---

## Monorepo structure

```
lanote/
├── AGENTS.md                  # product spec (this file)
├── pnpm-workspace.yaml
├── package.json               # root scripts (pnpm -r …)
├── docs/agents/
│   └── ARCHITECTURE.md        # technical architecture
├── apps/
│   ├── web/                   # Vue 3 + Vite (French UI)
│   └── server/                # Hono + @lanote/pronote-api + OpenRouter
├── packages/
│   ├── pronote-api/           # Vendored PRONOTE client (Merlode11 base + serialize/restore)
│   └── shared/                # Shared TS types (DTOs, PRONOTE ids)
└── supabase/
    └── migrations/
```

**Install & dev** (from repo root):

```bash
pnpm install
pnpm dev                         # API + web concurrently (ports 3001 + 5173)

# Or run individually:
pnpm --filter @lanote/server dev   # API, e.g. port 3001
pnpm --filter @lanote/web dev      # Vite, e.g. port 5173, proxy /api → 3001
```

---

## Security & compliance

- PRONOTE credentials: **localStorage only**; HTTPS to backend for proxy session only.
- PRONOTE proxy session state lives in `pronote_sessions` (backend read/write only); treat `session_data` as sensitive.
- `sessionToken` sent by the client is a signed reference (via `PRONOTE_SESSION_SECRET`), not the raw PRONOTE cookies.
- **Supabase service role key**: backend only; never shipped to the frontend or exposed in client env vars.
- Frontend talks **only** to the Hono API; the backend enforces learner scoping (via PRONOTE session / `pronote_account_hash`).
- Minimise minors' data; do not duplicate PRONOTE grades; do not persist evaluation copies.
- GDPR: delete analyses and plans via backend API → Supabase.

---

## Implementation order

1. Step 1 → 2 (connection + PRONOTE read)
2. Step 8 shell + Step 3 (daily activities)
3. Step 7 before Step 4 (time constraints)
4. Step 4 → 5 → 6 (evaluation loop)
5. Step 8 complete (aggregation)

---

## References

- [PRONOTE Campus — API Service Rest (INDEX ÉDUCATION)](https://www.index-education.com/fr/serviceRestHP.php#)
- [Merlode11/pronote-api](https://github.com/Merlode11/pronote-api) — upstream base for `@lanote/pronote-api` (npm packages unavailable)
- [EduWireApps/pronote-api](https://github.com/EduWireApps/pronote-api) — original fork lineage
- [pronotepy (Python)](https://pronotepy.readthedocs.io/)
- [OpenRouter](https://openrouter.ai/)
