# @lanote/pronote-api

Vendored PRONOTE client for LaNote, based on [Merlode11/pronote-api](https://github.com/Merlode11/pronote-api) (MIT).

LaNote additions:

- `serializeSession(session)` — persist session state to JSON
- `restoreSession(data)` — rebuild a session from JSON

Upstream GraphQL server (`bin/`, `src/server/`) is not included.
