# syntax=docker/dockerfile:1.7
# Imagen de producción para @app/web (Next.js 16) + @app/mcp (bun) en un solo contenedor.
# En Dokploy: Build Type = Dockerfile, Dockerfile Path = ./Dockerfile.
# Puertos: 3000 = web, 3001 = MCP. En Dokploy > Domains, un dominio por puerto
# (p. ej. firecent.app → 3000, mcp.firecent.app → 3001; clientes MCP: https://mcp.firecent.app/mcp).

ARG NODE_VERSION=22
ARG BUN_VERSION=1.4.4

FROM oven/bun:${BUN_VERSION} AS bun

FROM node:${NODE_VERSION}-slim AS base
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
RUN ln -s /usr/local/bin/bun /usr/local/bin/bunx
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 TURBO_TELEMETRY_DISABLED=1

# 1) Recorta el monorepo a lo que necesitan @app/web y @app/mcp (fuera apps/mobile)
FROM base AS pruner
COPY . .
RUN bunx turbo@2.11.10 prune @app/web @app/mcp --docker

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

# MCP: se empaqueta en un único archivo (deps + paquetes del monorepo + cliente
# Prisma), así la imagen final no necesita node_modules para él. Corre con bun.
RUN bun build apps/mcp/src/index.ts --target=bun --outfile /app/mcp-dist/index.js

# 3) Imagen final: servidor standalone de Next + MCP empaquetado
FROM node:${NODE_VERSION}-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 MCP_PORT=3001
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
RUN groupadd -r nodejs && useradd -r -g nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/mcp-dist ./apps/mcp/dist
COPY --chmod=755 scripts/docker-start.sh /usr/local/bin/docker-start

USER nextjs
EXPOSE 3000 3001
CMD ["docker-start"]
