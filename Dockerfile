# Tsundoku — SvelteKit (adapter-node) production image
# Build:  docker build -t tsundoku .
# Run:    docker run -p 3000:3000 --env-file .env tsundoku
# Compose: see README "Example minimal production compose.yaml for app + db".

# ---------- base: Node + pnpm ----------
FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

# ---------- deps: install dependencies (cached layer) ----------
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

# ---------- builder: build the SvelteKit app ----------
FROM base AS builder
# Dummy build-time secrets: SvelteKit's postbuild analyse imports server
# modules, and src/lib/server/db/index.ts throws without DATABASE_URL.
# `postgres()` is lazy (no connection during build), so a placeholder is fine.
# Real values are supplied at runtime and are NOT baked into the image.
ARG DATABASE_URL="postgres://tsundoku:tsundoku@localhost:5432/tsundoku"
ARG BETTER_AUTH_SECRET="build-time-dummy-secret-override-at-runtime"
ENV DATABASE_URL=$DATABASE_URL BETTER_AUTH_SECRET=$BETTER_AUTH_SECRET
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# ---------- runner: minimal production image ----------
FROM node:22-slim AS runner
ENV NODE_ENV=production \
	PORT=3000 \
	HOST=0.0.0.0 \
	DATA_DIR=/data
RUN corepack enable
WORKDIR /app

# Run as non-root (the `node` user ships with the official image).
RUN chown node:node /app && mkdir -p /data && chown node:node /data
USER node

# App metadata + lockfile for reproducible installs.
COPY --chown=node:node package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./

# Production node_modules. Full install (not --prod) is intentional:
# `drizzle-kit` (a devDependency) is needed to run `pnpm db:migrate` on startup.
COPY --chown=node:node --from=deps /app/node_modules ./node_modules

# adapter-node output + migrations.
COPY --chown=node:node --from=builder /app/build ./build
COPY --chown=node:node --from=builder /app/drizzle ./drizzle
COPY --chown=node:node --from=builder /app/drizzle.config.ts ./drizzle.config.ts

EXPOSE 3000

# Apply pending SQL migrations, then start the adapter-node server.
# Needs DATABASE_URL (and BETTER_AUTH_SECRET) in the environment.
# If the DB isn't ready yet, the container exits and your
# `restart:` policy / `depends_on` healthy DB will retry it.
CMD ["sh", "-c", "pnpm db:migrate && node build"]
