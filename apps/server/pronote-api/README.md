# PRONOTE client (vendored)

Plain source folder under `apps/server/pronote-api/` — not an npm package.

Based on [Merlode11/pronote-api](https://github.com/Merlode11/pronote-api) (MIT), with LaNote extensions:

- `serializeSession(session)` — JSON-safe snapshot for Supabase
- `restoreSession(data)` — rebuild session before proxying

Loaded at runtime by `apps/server/src/lib/pronote.ts`. Runtime npm dependencies (axios, jsdom, etc.) are declared on `@lanote/server`.

The folder includes a minimal `package.json` with `"type": "commonjs"` only — not a workspace package; it scopes Node’s module format for the vendored CJS sources.
