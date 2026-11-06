# syntax=docker/dockerfile:1.7
# Imagen de producción para @app/web (Next.js 16 + bun + turborepo).
# En Dokploy: Build Type = Dockerfile, Dockerfile Path = ./Dockerfile, puerto 3000.

ARG NODE_VERSION=22
ARG BUN_VERSION=1.4.4

FROM oven/bun:${BUN_VERSION} AS bun

FROM node:${NODE_VERSION}-slim AS base
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
RUN ln -s /usr/local/bin/bun /usr/local/bin/bunx
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 TURBO_TELEMETRY_DISABLED=1

# 1) Recorta el monorepo a lo que necesita @app/web (fuera apps/mobile y apps/mcp)
FROM base AS pruner
COPY . .
RUN bunx turbo@2.11.10 prune @app/web --docker

# 2) Instala dependencias (caché persistente de bun) y compila
FROM base AS builder
COPY --from=pruner /app/out/json/ .
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

COPY --from=pruner /app/out/full/ .
# `apps/web` ejecuta scripts/sync-tokens.ts de la raíz en su build; prune no lo copia
COPY scripts ./scripts

# Variables que se necesitan AL COMPILAR (pásalas en Dokploy como Build-time Arguments).
# - NEXT_PUBLIC_*: Next las incrusta en el bundle; sin ellas quedan vacías.
# - DATABASE_URL / BETTER_AUTH_SECRET: el código las exige al importarse, pero el
#   build no se conecta a la DB; los valores por defecto son solo de relleno.
#   Esta etapa no llega a la imagen final, así que no se filtran.
ARG NEXT_PUBLIC_APP_NAME
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_SITE_URL
ARG BETTER_AUTH_URL
ARG DATABASE_URL=postgresql://build:build@localhost:5432/build
ARG BETTER_AUTH_SECRET=build-only-placeholder-not-used-at-runtime

RUN --mount=type=cache,target=/app/apps/web/.next/cache \
    bunx turbo run build --filter=@app/web

# 3) Imagen final: solo el servidor standalone de Next
FROM node:${NODE_VERSION}-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN groupadd -r nodejs && useradd -r -g nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
