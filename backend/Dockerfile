# syntax=docker/dockerfile:1
# Veyro API image (step 6.2). Four stages, so the final image carries only what runs:
#   build      all dependencies, generates the Prisma client and compiles the TypeScript
#   prod-deps  the same node_modules without the development packages
#   migrate    the build stage plus a default command that applies the database migrations (used by docker-compose and CI)
#   runtime    production dependencies and the compiled output, as a non-root user (this is the default target and stays last)
# Build from this folder:  docker build -t veyro-api backend      Migrations:  docker build --target migrate -t veyro-migrate backend

FROM node:22-bookworm-slim AS build
WORKDIR /app
# Dependencies first: this layer is rebuilt only when the lockfile changes.
COPY package.json package-lock.json ./
RUN npm ci
COPY nest-cli.json tsconfig.json prisma.config.ts ./
COPY prisma ./prisma
COPY src ./src
# `prisma generate` reads prisma.config.ts, which wants a database URL even though generating never connects to it.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npm run build

FROM build AS prod-deps
RUN npm prune --omit=dev

FROM build AS migrate
ENV NODE_ENV=production
CMD ["npx", "prisma", "migrate", "deploy"]

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=5000
WORKDIR /app
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
USER node
EXPOSE 5000
# The same endpoint the platform health checks use: it also reports whether the database answers.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+process.env.PORT+'/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "dist/main"]
