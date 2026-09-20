# Tsundoku 📚

A self-hosted personal manga tracker. Track your series, volumes, orders, reading progress, and spending — all in one place.

> _Tsundoku_ (積ん読) — the art of buying books and letting them pile up unread. This app helps you manage the pile.

## Features

### 📖 Series collection

- Create, edit, and delete series with title, author, and publication status (`Ongoing` / `Completed` / `Hiatus` / `Cancelled`)
- Fuzzy search with field filters, e.g. `title:naruto author:kishimoto -boruto`, quoted phrases supported
- Series overview shows latest cover and volume number

### 📦 Volume tracking

- Per-volume shelf status: `Wishlist` → `Ordered` → `Owned`
- Per-volume reading progress: `Not Read` / `Reading` / `Completed` (reading progress requires `Owned`)
- Store cover URL, ISBN, volume number (unique per series)
- Or upload a cover image / paste an image URL — the server saves its own copy (`DATA_DIR`), so rotting hotlinks can't break your library
- Purchase info per volume: paid price, original/list price, currency, purchase month (`boughtAt`). An empty price means "never entered" (e.g. a gift) — it is stored as `NULL`, not `0.00` (which would mean free), so stats stay accurate.
- Grid / list views, inline status changes

### 🧾 Orders

- Orders with store name, order number, order date, currency, receipt URL (or uploaded receipt file/PDF), and notes
- Attach volumes to orders (one volume can only be in one order)
  - A volume must have a price and a currency before it can join an order — record those first, then attach it
  - The volume's currency must match the order's currency, and an order operates in a single currency while it has volumes (order currency is locked until it's emptied)
- Order adjustments for shipping, fees, discounts: `+` amounts are fees, `-` amounts are discounts, with automatic subtotal / total calculation
- Order search: `order/store/title/author/volume/paidPrice/originalPrice/date/note`, comparison operators (`>`, `<`, `>=`, `<=`)

### 💰 Finances & stats

- Total spend per currency: books cost, fees, discounts, amount saved and total paid
- Monthly spending chart with average books / fees / savings
- Custom / this-year / all-time ranges
- "Undated books" helper page lists volumes with no order and no purchase month so stats stay accurate

### 🏠 Dashboard

- Reading-progress donut
- `Currently Reading` widget with one-click mark-as-read
- `Ordered` widget with one-click mark-as-owned (warns if price / date is missing)

### 🔒 Auth & self-hosting friendly

- Email + password auth via [Better Auth](https://www.better-auth.com/)
- `MAX_USERS` registration gate: `1` = single-user (default), `0` = closed registration, empty = unlimited
- No email service required — password resets are done server-side via script (see below)
- Multi-user safe: users can only see and interact with their own data
- English + Polish UI with in-app language switcher (Help in translating this app into other languages is welcomed and appreciated!)
- Desktop and Mobile friendly layout

## Tech stack

- [SvelteKit 2](https://svelte.dev/) + Svelte 5 + `@sveltejs/adapter-node`
- [Tailwind CSS 4](https://tailwindcss.com/) + [Skeleton UI](https://www.skeleton.dev/) + [Lucide](https://lucide.dev/) icons
- [Drizzle ORM](https://orm.drizzle.team/) + [postgres.js](https://github.com/porsager/postgres) + PostgreSQL
- [Better Auth](https://www.better-auth.com/) for sessions
- [Paraglide](https://inlang.com/) for i18n (`en`, `pl`)
- [Fuse.js](https://www.fusejs.io/) for fuzzy search, [LayerChart](https://layerchart.com/) + `date-fns` for stats
- `pnpm`, `vite`, `vitest`, `zod`, `pino` logging

## Getting started

### Prerequisites

- Node.js 20+ and `pnpm`
- Docker + Docker Compose (recommended for PostgreSQL), **or** an existing PostgreSQL database

### 1. Configure

```sh
cp .env.example .env
```

| Variable             | Required | Default                      | Description                                                                                                       |
| -------------------- | -------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`       | yes      | —                            | Postgres connection string, e.g. `postgres://tsundoku:tsundoku@localhost:5432/tsundoku`                           |
| `BETTER_AUTH_SECRET` | yes      | —                            | 32+ char secret for sessions. Generate with `openssl rand -base64 32`                                             |
| `ORIGIN`             | no       | `http://localhost:5173`      | Public base URL. Required in production for CSRF/cookies, e.g. `https://tsundoku.example.com` (no trailing slash) |
| `MAX_USERS`          | no       | `1`                          | Registration cap. `1` = single-user, `0` = disabled, empty = unlimited                                            |
| `LOG_LEVEL`          | no       | `info`                       | Pino log level: `fatal, error, warn, info, debug, trace, silent`                                                  |
| `DATA_DIR`           | no       | `./data` (`/data` in Docker) | Directory for self-hosted uploads (covers, receipts). Served only to their owner                                  |

### 2a. Run with Docker (PostgreSQL) + local app — recommended for homelab

`compose.yaml` ships a ready-to-use Postgres:

```sh
# start Postgres in the background
docker compose up -d

# install deps, push schema, run dev server
pnpm install
pnpm db:push
pnpm dev
```

Open http://localhost:5173, register your first user, done.

### 2b. Run against an existing external PostgreSQL (no Docker)

Just point `DATABASE_URL` at it:

```sh
cp .env.example .env
# edit DATABASE_URL, BETTER_AUTH_SECRET, ORIGIN
pnpm install
pnpm db:migrate   # or pnpm db:push
pnpm build
node build
```

The production build is an `adapter-node` app:

- listens on `PORT` (default `3000`), `HOST`, etc. per [adapter-node env vars](https://svelte.dev/docs/kit/adapter-node#environment-variables)
- needs `ORIGIN`, `DATABASE_URL`, and `BETTER_AUTH_SECRET` set in the environment

Example minimal production `compose.yaml` for app + db:

```yaml
services:
  app:
    build: .
    ports:
      - '3000:3000'
    environment:
      ORIGIN: 'https://tsundoku.example.com'
      DATABASE_URL: 'postgres://tsundoku:tsundoku@db:5432/tsundoku'
      BETTER_AUTH_SECRET: '${BETTER_AUTH_SECRET}'
      MAX_USERS: '1'
      DATA_DIR: '/data'
    volumes:
      - appdata:/data
    depends_on:
      - db
  db:
    image: postgres:16
    restart: always
    environment:
      POSTGRES_USER: tsundoku
      POSTGRES_PASSWORD: tsundoku
      POSTGRES_DB: tsundoku
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
  appdata:
```

(A ready-made version of this lives in `compose.prod.yaml`, using the prebuilt GHCR image instead of `build: .`.)

> Note: this repo currently ships `compose.yaml` with only the `db` service. Pair it with the `adapter-node` build (`pnpm build && node build`) or wrap the app in your own `Dockerfile` (e.g. `FROM node:22-slim ... COPY build ... CMD ["node", "build"]`) and run migrations on startup with `pnpm db:migrate`.

## Scripts

| Command                                | Description                                                   |
| -------------------------------------- | ------------------------------------------------------------- |
| `pnpm dev`                             | Start dev server                                              |
| `pnpm build` / `pnpm preview`          | Build / preview production bundle (`adapter-node` → `build/`) |
| `pnpm check`                           | `svelte-kit sync` + `svelte-check`                            |
| `pnpm lint` / `pnpm format`            | Prettier + ESLint check / write                               |
| `pnpm test`                            | Run `vitest` unit tests                                       |
| `pnpm db:start`                        | `docker compose up` (Postgres)                                |
| `pnpm db:push`                         | Push Drizzle schema directly (dev)                            |
| `pnpm db:generate` / `pnpm db:migrate` | Generate / apply SQL migrations (`drizzle/`)                  |
| `pnpm db:studio`                       | Open Drizzle Studio                                           |
| `pnpm db:backup`                       | Plain-SQL dump of the database into `backups/` (see below)    |
| `pnpm files:prune`                     | Delete staged-but-never-linked uploads older than 24h         |
| `pnpm user:reset-password`             | Reset a user's password server-side (no email service needed) |

## Password reset

No email service is configured, so there is no self-service "forgot password" flow. With server access, reset any account directly:

```sh
npm run user:reset-password -- user@example.com
# with pnpm, drop the `--` (pnpm forwards it as an argument):
pnpm run user:reset-password user@example.com
```

Omit the password to be prompted with hidden input (keeps it out of shell history). The script hashes with Better Auth's own script setup, updates the credential account, and revokes all of the user's sessions. Needs `DATABASE_URL` (loaded from `.env`).

## Backups & upgrading

**Back up before every upgrade** — it is the only thing that can save you from a bad migration. Back up **both** the database and the uploaded files (`DATA_DIR` — covers, receipts):

```sh
pnpm db:backup
# backups/<database>-<timestamp>.sql
tar -czf backups/files-<timestamp>.tar.gz ./data
```

The dump is plain SQL with `--clean --if-exists`, so it restores over an existing database:

```sh
# dockerized postgres (compose.yaml):
docker compose exec -T db psql -U tsundoku -d tsundoku < backups/<file>.sql

# any other postgres:
psql "$DATABASE_URL" -f backups/<file>.sql

# restore the uploaded files (DATA_DIR):
tar -xzf backups/files-<timestamp>.tar.gz

# dockerized app (compose.prod.yaml): the files live in the `appdata` volume —
# back it up straight from the volume instead of ./data:
docker run --rm -v tsundoku_appdata:/data -v "$PWD/backups:/backup" alpine \
  tar -czf /backup/files-<timestamp>.tar.gz -C /data .
```

Anyone with a copy of these backups can read everything in them (reading habits included), so keep them encrypted at rest (LUKS volume, encrypted remote, or e.g. `age`/`gpg` the archives).

To upgrade a deployed instance:

```sh
pnpm db:backup
git pull
pnpm install
pnpm db:migrate
```

Since this project is in a very early stage expect database schema changes. I will try my best to make them clean but for your own sanity please backup before upgrading!
