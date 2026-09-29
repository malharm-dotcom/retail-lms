# Retail Learning Desk

Desktop-first LMS for Snitch retail employees and HR. HR builds versioned modules (YouTube or uploaded video, PDF, text, quiz, policy acknowledgement), imports staff from CSV, assigns learning to everyone / a store / a department / individuals, and tracks completion per person. Employees sign in with an employee code, work through assigned modules in order, and every step is recorded server-side.

## Stack

- Next.js 14, TypeScript, React
- PostgreSQL with Prisma
- NextAuth credentials sessions
- Nixpacks / Node.js 22 for Coolify

## Run locally

Requirements: Node.js 22 and PostgreSQL.

```powershell
Copy-Item .env.example .env.local
npm install
npm run db:deploy
npm run db:seed
npm run dev
```

Open `http://localhost:3000`.

Local seed accounts:

- Admin: `ADMIN001` / `ChangeMe@123`
- Employee: `EMP001` / `Learn@123`

The production seed does not create sample employees or training content.

## Environment variables

| Variable | Required in production | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Coolify PostgreSQL private connection URL |
| `NEXTAUTH_URL` | Yes | Public HTTPS application URL |
| `NEXTAUTH_SECRET` | Yes | Random secret of at least 32 characters |
| `APP_DEPLOY_ENV` | Yes | Set to `production` |
| `APP_BASE_URL` | Yes | Public HTTPS application URL used by future email links |
| `SEED_ADMIN_CODE` | Yes for first seed | Initial admin employee code |
| `SEED_ADMIN_NAME` | Yes for first seed | Initial admin display name |
| `SEED_ADMIN_PASSWORD` | Yes for first seed | Strong initial admin password |
| `EMAIL_ENABLED` | No | `true` to send assignment emails and reminders |
| `SMTP_HOST` | When email is enabled | SMTP server hostname |
| `SMTP_PORT` | When email is enabled | Usually `587` |
| `SMTP_SECURE` | When email is enabled | `true` for implicit TLS, otherwise `false` |
| `SMTP_USER` | When email is enabled | SMTP username |
| `SMTP_PASSWORD` | When email is enabled | SMTP password |
| `SMTP_FROM` | When email is enabled | Sender name and address |
| `CRON_SECRET` | When email is enabled | Bearer secret for `/api/cron/email` (16+ chars) |

Generate secrets with a password manager or `openssl rand -base64 48`. Do not commit `.env` files.

## Deploy on Coolify

This repository is designed for one production environment. Keep automatic deployment disabled for the first release; deploy manually after each verified change.

1. Create a PostgreSQL resource in the same Coolify project.
2. Add this GitHub repository as an application and select the `main` branch.
3. Choose Nixpacks. The repository pins Node.js 22 in `nixpacks.toml`.
4. Set port `3000` and health-check path `/api/health`.
5. Add the production environment variables above. Use the database's private/internal URL.
6. Deploy the application.
7. Set the **Post-deployment** command to `npm run db:deploy && npm run db:seed` for the first deploy (pre-deployment runs in the old container and is skipped on a first deploy).
8. Sign in with `SEED_ADMIN_CODE` and `SEED_ADMIN_PASSWORD`, then change Post-deployment to `npm run db:deploy` and delete `SEED_ADMIN_PASSWORD`. Re-running the seed resets the admin password, which is the recovery path if it is lost.

The seed is idempotent. In production it only creates or restores the configured super-admin account and resets its password to `SEED_ADMIN_PASSWORD`, so re-running it is the admin-password recovery path. After the first successful seed, remove `SEED_ADMIN_PASSWORD` from Coolify unless another seed run is required.

Before every later database migration, take a PostgreSQL backup and run `npm run db:deploy` before restarting the new application version. With no staging environment, database backups and manual deployment are the rollback boundary.

## Commands

```sh
npm test               # unit tests
npm run typecheck      # TypeScript checks
npm run lint           # Next.js lint
npm run build          # production build
npm run db:generate    # regenerate Prisma client
npm run db:migrate     # create/apply a local development migration
npm run db:deploy      # apply checked-in migrations
npm run db:seed        # idempotent bootstrap data
```

## What HR can do

- **Modules** (`/admin/modules`): build a draft with sections and lessons — YouTube video or an uploaded video file (MP4/MOV/WebM up to 500 MB, stored in Postgres in 8 MB chunks and streamed with seeking; both use unique watched-seconds tracking, default 95%), PDF up to 25 MB (export PowerPoint to PDF first), or text. Optional quiz (multiple choice / true-false, pass mark) and policy acknowledgement. Publishing locks the version; “Edit as new version” copies it into a new draft. Learners keep the version they were assigned.
- **People** (`/admin/people`): CSV import (template at `/admin/people/template`). New people get a one-time temporary password, downloadable as a credentials CSV, and must change it at first sign-in. Stores and departments are created from the CSV. Deactivate instead of delete; history stays.
- **Assignments** (`/admin/assignments`): everyone, a store, a department, or employee codes; due date and mandatory flag. New and moved employees are enrolled into open group assignments automatically.
- **Reports** (`/admin/reports`): completion by store and module, overdue list, CSV export of every enrolment with quiz score and acknowledgement time.
- **Audit log** (`/admin/audit`): every admin change.

## Completion rules

A module completes when every required lesson is complete, the quiz (if any) is passed, and the acknowledgement (if any) is confirmed. Video completion counts only seconds actually played in a visible tab (skipping ahead does not count, speed capped at 2x). PDF and text lessons complete when the learner confirms they have read them — the quiz or acknowledgement is the real evidence. Status is always recalculated on the server.

## Email

Email is off until `EMAIL_ENABLED=true` and the `SMTP_*` variables are set. When on, assigning a module queues an email to learners who have an address, and the cron endpoint sends due-soon/overdue reminders (mandatory work due within 3 days or overdue, at most every 3 days per person).

Add a Coolify **Scheduled Task** on the application, e.g. hourly (`0 * * * *`):

```sh
curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/email
```

`CRON_SECRET` must be at least 16 characters.
