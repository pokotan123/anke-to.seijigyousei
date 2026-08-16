# AGENTS.md

Standard project overview, directory layout, and the common dev commands live in `CLAUDE.md` and `起動ガイド.md`. Read those first. This file only records non-obvious, durable caveats for agents.

## Cursor Cloud specific instructions

### Services & how to run them
- This is a single product (survey/voting system) with two tiers plus datastores:
  - Backend (Express + Socket.io): `cd backend && npm run dev` → port `3001`
  - Frontend (Next.js): `cd frontend && npm run dev` → port `3000`
  - PostgreSQL 16 (port `5432`) and Redis 7 (port `6379`) are installed natively (not Docker — Docker is not available in this environment).
- The frontend talks to the backend via `NEXT_PUBLIC_API_URL` (default `http://localhost:3001`); admin login is at `http://localhost:3000/admin/login` with `admin` / `admin123`.

### Starting datastores (no systemd in this VM)
systemd is not running, so Postgres/Redis do NOT auto-start on VM boot. Start them manually before running the backend:
```bash
sudo pg_ctlcluster 16 main start   # PostgreSQL on :5432
sudo redis-server --daemonize yes  # Redis on :6379
```
Their data lives in the VM snapshot, so the `survey_db` database, schema, and seeded admin persist across sessions — you normally only need to (re)start the processes, not re-create the DB.

### Backend env
`backend/.env` is already configured for local dev (`DATABASE_URL` on `:5432`, `REDIS_URL` on `:6379`, `DB_SSL=false`, `NODE_ENV=development`, a dev `JWT_SECRET`). It is gitignored. Redis is optional — the backend logs a warning and runs without it, but realtime analytics/caching are degraded. Email flows (Resend) require a real `RESEND_API_KEY`; without it, the traditional `/vote/{token}` flow and admin UI still work.

### Database schema — important gotcha
`npm run migrate` splits `backend/database/init.sql` on `;`, which **corrupts `DO $$ ... $$` blocks and `CREATE FUNCTION` bodies**, so a fresh `migrate` creates no tables. To (re)initialize the schema, apply the file directly instead:
```bash
PGPASSWORD=survey_password psql -h localhost -U survey_user -d survey_db -f backend/database/init.sql
```
`connectDatabase()` also runs a small self-healing auto-migration (adds columns + `audit_logs`) on every backend startup.

### Admin credentials
`init.sql` inserts an `admin` row with a placeholder (invalid) bcrypt hash, and `npm run seed` skips it as "already exists". Run `npm run reset-password` (backend) to set a valid `admin` / `admin123` login.

### Lint is not configured
Neither `backend` nor `frontend` has an ESLint config committed. `backend`'s `npm run lint` fails with "couldn't find a configuration file", and `frontend`'s `npm run lint` (`next lint`) drops into an interactive setup prompt. Treat lint as unavailable unless a config is added.
