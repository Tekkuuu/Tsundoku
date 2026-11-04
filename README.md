# Tsundoku 📚

A self-hosted personal manga tracker. Track your series, volumes, orders, reading progress, and spending.

> _Tsundoku_ (積ん読) — the art of buying books and letting them pile up unread.

## Features

### 📖 Series collection

- Create, edit, and delete series
- Batch-add multiple series at once
- Series status: `Ongoing` / `Completed` / `Hiatus` / `Cancelled`
- Fuzzy search with field filters, e.g. `title:naruto author:kishimoto -boruto`
- Grid / list views

### 📦 Volume tracking

- Per-volume shelf status: `Wishlist` / `Ordered` / `Owned`
- Per-volume reading progress: `Not Read` / `Reading` / `Completed`
- Reading dates (started / finished) and read count
- Batch-add multiple volumes at once
- Store volume metadata with cover image (upload or import from URL)
- Purchase info and purchase month
- Grid / list views

### 🧾 Orders

- Orders with store name, order number, order date, currency, receipt and notes
- Add volumes to orders and edit their prices
- Automatic order total / subtotal calculation based on added items and adjustments
- Order adjustments: e.g. shipping, fees, discounts
- Search and filter by `order/store/title/author/volume/paidPrice/originalPrice/date/note`, with numeric/date operators and exclusions

### 💰 Finances & stats

- Total spend per currency: volumes cost, fees, discounts, amount saved and total paid
- Monthly spending chart with averages and a month-by-month breakdown
- Custom / this-year / all-time ranges
- "Undated books" helper page lists volumes with no order and no purchase month

### 🏠 Dashboard

- KPI marquee: series, owned / read / ordered / wishlisted volumes and orders
- Reading-progress overview
- Reading calendar (month / year) with finished volumes and scheduled reads
- `Currently Reading`, `Ordered`, and `To read` carousels with quick actions
- Searchable unread backlog

### 🔒 Auth & self-hosting friendly

- Email + password auth with usernames via [Better Auth](https://www.better-auth.com/)
- `MAX_USERS` registration gate: `1` = single-user (default), `0` = closed registration, empty = unlimited
- Password resets done via console script (see below)
- English + Polish UI with in-app language switcher (Help in translating this app into other languages is welcomed and appreciated!)
- Desktop and Mobile friendly layout

### 🌎 Translations

| Language | Translated by                          |
| -------- | -------------------------------------- |
| English  | [@Tekkuuu](https://github.com/Tekkuuu) |
| Polish   | [@Tekkuuu](https://github.com/Tekkuuu) |

Help with translations to other languages is appreciated!
See `messages/en.json` for reference

## Tech stack

- [SvelteKit 3](https://svelte.dev/) + Svelte 5 + `@sveltejs/adapter-node`
- [Vite+](https://viteplus.dev/) — unified toolchain for dev, build, test, lint, and format
- [Tailwind CSS 4](https://tailwindcss.com/) + [Skeleton UI](https://www.skeleton.dev/) + [Lucide](https://lucide.dev/) icons
- [Drizzle ORM](https://orm.drizzle.team/) + [postgres.js](https://github.com/porsager/postgres) + PostgreSQL
- [Better Auth](https://www.better-auth.com/)
- [Paraglide](https://inlang.com/)
- [Fuse.js](https://www.fusejs.io/), [LayerChart](https://layerchart.com/) + [Date FNS](https://date-fns.org/)
- [Zod](https://zod.dev/), [Pino](https://getpino.io/)

## Getting started

### Prerequisites

- [Vite+](https://viteplus.dev/) (`vp`) — manages Node.js and pnpm for the project. See the [Vite+ guide](https://viteplus.dev/guide/) for installation instructions.
- Docker + Docker Compose, **or** an existing PostgreSQL database

### Configure

```sh
cp .env.example .env
```

| Variable             | Required | Default                      | Description                                                                                   |
| -------------------- | -------- | ---------------------------- | --------------------------------------------------------------------------------------------- |
| `DATABASE_URL`       | yes      | —                            | Postgres connection string, e.g. `postgres://tsundoku:tsundoku@localhost:5432/tsundoku`       |
| `BETTER_AUTH_SECRET` | yes      | —                            | 32+ char secret for sessions. Generate with e.g. `openssl rand -base64 32`                    |
| `ORIGIN`             | no       | `http://localhost:5173`      | Public base URL. Required in production for CSRF/cookies, e.g. `https://tsundoku.example.com` |
| `MAX_USERS`          | no       | `1`                          | Registration cap. `1` = single-user, `0` = disabled, empty = unlimited                        |
| `LOG_LEVEL`          | no       | `info`                       | Pino log level: `fatal, error, warn, info, debug, trace, silent`                              |
| `DATA_DIR`           | no       | `./data` (`/data` in Docker) | Directory for self-hosted uploads (covers, receipts). Served only to their owner              |

### 1) Run from repo with docker

`compose.yaml` with a ready-to-use Postgres:

```sh
# start Postgres in the background
docker compose up -d

# install deps, apply migrations, run dev server
vp install
vp run db:migrate
vp dev
```

Open http://localhost:5173, register your first user, done.

### 2) Run from repo without docker (existing database)

Just point `DATABASE_URL` at it:

```sh
cp .env.example .env
# edit DATABASE_URL, BETTER_AUTH_SECRET, ORIGIN
vp install
vp run db:migrate
vp build
node build
```

### 3) Run docker package

Copy `compose.prod.yaml` - ready to use, just change environment variables.

It pulls the App alongside a PostgreSQL database.
Just remove the database service from docker compose if you want to use existing database

## Scripts

| Command                                    | Description                                                       |
| ------------------------------------------ | ----------------------------------------------------------------- |
| `vp dev`                                   | Start dev server                                                  |
| `vp build` / `vp preview`                  | Build / preview production bundle (`adapter-node` → `build/`)     |
| `vp check`                                 | Format, lint, and type-check (`vp check --fix` writes fixes)      |
| `vp fmt` / `vp lint`                       | Format / lint only                                                |
| `vp test`                                  | Run Vitest unit tests                                             |
| `vp run db:start`                          | `docker compose up` (Postgres)                                    |
| `vp run db:push`                           | Push Drizzle schema directly (dev; use migrations for a fresh DB) |
| `vp run db:generate` / `vp run db:migrate` | Generate / apply SQL migrations (`drizzle/`)                      |
| `vp run db:studio`                         | Open Drizzle Studio                                               |
| `vp run db:backup`                         | Plain-SQL dump of the database into `backups/` (see below)        |
| `vp run files:prune`                       | Delete staged-but-never-linked uploads older than 24h             |
| `vp run user:reset-password <email>`       | Reset a user's password server-side (no email service needed)     |

## Password reset

No email service is configured, so there is no self-service "forgot password" flow. With server access, reset any account directly:

```sh
vp run user:reset-password user@example.com
```

Omit the password to be prompted with hidden input (keeps it out of shell history). The script hashes with Better Auth's own script setup, updates the credential account, and revokes all of the user's sessions. Needs `DATABASE_URL` (loaded from `.env`).

## Backups & upgrading

**Back up before every upgrade** — you own the data! There is no automatic backup unless you do it yourself!. Back up **both** the database and the uploaded files (`DATA_DIR` — covers, receipts):

```sh
vp run db:backup
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

Anyone with a copy of these backups can read everything in them, so keep them encrypted.

To upgrade a deployed instance:

```sh
vp run db:backup
git pull
vp install
vp run db:migrate
```

**or**, using the production docker compose:

```sh
docker compose pull
docker compose up -d
```

It applies migrations from the new version automatically, so **backup** before updating!

Since this project is in a very early stage expect database schema changes. I will try my best to make them clean but for your own sanity please backup before upgrading!
