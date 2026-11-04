# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-bookworm-slim AS builder
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
# Build-only key: runtime always requires a separate AUTH_SECRET from the environment.
RUN AUTH_SECRET=build-only-placeholder-key-never-use-at-runtime AUTH_URL=http://localhost:3000 npm run build

FROM node:24-bookworm-slim AS runner
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000 DATA_DIR=/app/data
WORKDIR /app
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/scripts/plugin-socket.mjs /app/scripts/docker-entry.mjs ./
RUN mkdir -p /app/data /run/ervisio-todo && chown node:node /app/data /run/ervisio-todo
USER node
EXPOSE 3000
VOLUME ["/app/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
# docker-entry.mjs starts the optional plugin socket (PLUGIN_SOCKET), then server.js.
CMD ["node", "docker-entry.mjs"]
