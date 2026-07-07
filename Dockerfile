# syntax=docker/dockerfile:1

# ============================================================
# Stage 1: Base (shared Node + pnpm setup)
# ============================================================
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate

# ============================================================
# Stage 2: Install all dependencies
# ============================================================
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ============================================================
# Stage 3: Build
# ============================================================
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time env vars (NEXT_PUBLIC_* are baked into client bundle)
ARG NEXT_PUBLIC_BASE_PATH=""
ENV NEXT_PUBLIC_BASE_PATH=${NEXT_PUBLIC_BASE_PATH}

# Skip DB migration during build (DB not available); only run next build
RUN pnpm exec next build

# ============================================================
# Stage 4: Production runner
# ============================================================
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

# Minimal tools for migration script
RUN apk add --no-cache bash

# Install only migration-related deps locally
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
RUN pnpm init -y 2>/dev/null; pnpm add tsx drizzle-orm postgres dotenv

# Copy standalone server output
COPY --from=builder /app/.next/standalone ./
# Copy static assets and public files
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
# Copy migration files and drizzle config for runtime migration
COPY --from=builder /app/lib/db/migrations ./lib/db/migrations
COPY --from=builder /app/lib/db/schema.ts ./lib/db/schema.ts
COPY --from=builder /app/lib/db/migrate.ts ./lib/db/migrate.ts
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts

# Copy entrypoint
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "server.js"]
