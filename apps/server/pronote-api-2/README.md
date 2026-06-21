# pronote-api-2

TypeScript PRONOTE client for LaNote — **authentication only** (Step 1).

Uses native `fetch` (no axios/jsdom). The legacy `pronote-api/` folder is kept as reference but is no longer used by `@lanote/server`.

## Flow

1. **TGC login** (`login-tgc.ts`) — replay `docs/agents/login.har`:
   - GET PRONOTE URL → CAS redirect
   - Inject browser CAS cookies → ticket → `eleve.html`
   - Parse `Start({h,a,e,f,…})`

2. **PRONOTE session** (`login.ts`) — same as legacy client:
   - `FonctionParametres` → `Identification` / `Authentification` (CAS `e`/`f`) → `ParametresUtilisateur`

## Public API

```typescript
import { loginStudentFromTgc, serializeSession, restoreSession, errors } from './index.js';

const session = await loginStudentFromTgc(url, casCookies);
const snapshot = serializeSession(session);
const restored = restoreSession(snapshot);
await session.logout();
```

## Debug

Set `PRONOTE_DEBUG=1` (default on) for `[pronote-login]` logs.
