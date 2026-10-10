# syntax=docker/dockerfile:1

# ── 1. Dependencies ──────────────────────────────────────────
FROM node:24-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ── 2. Build ─────────────────────────────────────────────────
FROM node:24-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
    BUILD_STANDALONE=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ── 3. Runtime: the standalone server only ───────────────────
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -S -g 1001 junto && adduser -S -u 1001 -G junto junto
COPY --from=build --chown=junto:junto /app/.next/standalone ./
COPY --from=build --chown=junto:junto /app/.next/static ./.next/static
COPY --from=build --chown=junto:junto /app/public ./public
# SQL migrations, applied automatically on start-up.
COPY --from=build --chown=junto:junto /app/drizzle ./drizzle
USER junto
EXPOSE 3000
# Hosts such as Render pass their own PORT; the server and this check both follow it.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3000}/api/health" >/dev/null || exit 1
CMD ["node", "server.js"]
