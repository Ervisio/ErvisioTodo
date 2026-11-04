# Runtime and deployment

Purpose: Local setup, complete standalone artifacts, Docker and Caddy host routing.
Entry points: scripts/setup.mjs; scripts/start.mjs; scripts/prepare-standalone.mjs; Dockerfile; compose.yaml; compose.caddy.yaml; deploy/Caddyfile.docker.
Flow: npm run build → Next standalone output → copy public/static assets and remove bundled .env files → runtime configuration.
Invariants:

- npm start loads .env, resolves DATA_DIR before loading standalone server.js, and binds BIND_HOST or 127.0.0.1.
- Docker runs server.js directly as node, binds 0.0.0.0, persists /app/data and probes /api/health.
- Compose exposes app on host loopback; Caddy adds public HTTP/HTTPS and supplies X-Real-IP as the configured trusted IP header.
- AUTH_URL is a canonical HTTP(S) origin without path/query/credentials; AUTH_SECRET must be at least 32 characters.
- AUTH_COOKIE_DOMAIN must match BASE_DOMAIN and include AUTH_URL's hostname; changing AUTH_SECRET invalidates sessions.
- Caddy on-demand TLS asks /api/caddy/ask; security.allowedHost authorizes the canonical host and assigned list subdomains.
  Gotchas:
- DNS for the canonical host and wildcard subdomains must point to the server separately from app settings.
- Build uses a placeholder secret only; runtime needs its own configuration. Standalone assets must be prepared after Next builds.
- Caddy, application and upload quotas have separate request size limits.
- OAuth provider configuration and callback URLs require a deployment-specific login check; unit tests cannot establish live OAuth success.
  Verification:
- npm run typecheck; npm test; npm run build; npm run format:check.
- npm run test:e2e uses isolated fixture server localhost:3137 and test SMTP ports 2527/2528; it refuses server reuse.
- npm run test:docker uses local Caddy CA and ports 3138/3443, checks persistence and subdomain SSO, and cleans its own resources.
  Related: map/storage.md, map/auth-api.md.
