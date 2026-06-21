# PRONOTE client (vendored)

Plain source folder under `apps/server/pronote-api/` — not an npm package.

Initially based on [Merlode11/pronote-api](https://github.com/Merlode11/pronote-api) (MIT). The **login / SSO layer was rewritten** from a successful manual capture (`docs/agents/connexion.har`). Pre-rewrite sources are kept in `_reference/` for comparison.

## LaNote extensions

- `serializeSession(session)` / `restoreSession(data)` — JSON snapshots for Supabase
- PRONOTE 2025+ protocol (`Start({a,d,…})`, `fd=1` login page, new `appelfonction` payload)
- `src/sso/` — EduConnect SAML flow (`j_username` / `j_password`, two-step e1s2 → e1s3 consent)
- `src/sso/cas-educonnect.js` — KOSMOS CAS (e.g. Haute-Garonne) → EduConnect → PRONOTE

Loaded at runtime by `apps/server/src/lib/pronote.ts`. Runtime npm dependencies (axios, jsdom, etc.) are declared on `@lanote/server`.

**Login troubleshooting**: set `PRONOTE_DEBUG=0` to silence step logs. By default, login steps are logged to the server console with the `[pronote-login]` prefix (passwords are never logged).

The folder includes a minimal `package.json` with `"type": "commonjs"` only — not a workspace package; it scopes Node’s module format for the vendored CJS sources.
