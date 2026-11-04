# Authentication and API policy

Purpose: Account identity, session revocation, API tokens and reusable API contracts.
Entry points: lib/auth.ts; app/api/auth/[...nextauth]/route.ts; app/api/account/[action]/route.ts; app/api/v1/[...path]/route.ts; app/api/admin/[...path]/route.ts.
Flow: route → lib/server/http.ts:requireUser → session or tokens.actorFromToken → api-policy.actorContext → service authorization → SQLite.
Invariants:

- First registered account becomes admin. Passwords are bcrypt hashes; users and email addresses are normalized.
- OAuth identities require explicit account linking; email equality alone never links accounts. Provider availability also depends on runtime settings.
- JWT callbacks reload active user and session_version; changing the version revokes existing sessions.
- Bearer tokens are hashed, scoped, expiring and subject to active-owner/workspace policy. The plaintext secret is returned only at creation.
- Derived token chains intersect scopes and resource restrictions; children cannot broaden parent grants or expiry.
- AsyncLocalStorage actorContext carries resource restrictions into service calls; preserve it in new and compatibility routes.
- Cookie-authenticated API writes check origin; bearer authorization uses token policy. Write rate limits also apply.
- Admin service gates protect the last active admin; managed-account changes revoke sessions and tokens as implemented in admin-users.ts.
  Contracts:
- lib/api-catalog.ts:API_OPERATIONS and matchOperation define operations and scope matching.
- scripts/generate-openapi.mjs generates docs/openapi.json and docs/ErvisioTodo.postman_collection.json; run npm run docs:api after contract changes.
- lib/server/http.ts:api converts validation and HttpError failures to success/error JSON envelopes; unexpected failures return generic 500 responses.
  Gotchas: UI visibility and an admin role do not replace per-resource service authorization; test direct API access and compatibility routes too.
  Verification: tests/api-contract.test.ts checks catalog/OpenAPI/Postman parity and refs; tests/todo.test.ts covers linking, token chains, revocation and resource isolation; tests/app.spec.ts exercises HTTP auth and role denials.
  Related: map/todo.md, map/settings-ui.md, map/storage.md, map/deployment.md.
