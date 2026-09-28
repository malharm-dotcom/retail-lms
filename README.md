# Retail Learning Desk

Desktop-first LMS for retail employees and HR teams. The current foundation includes employee-code login, role-based access, the core learning/compliance data model, employee and admin dashboards, a production migration, and Coolify-ready configuration.

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
| `EMAIL_ENABLED` | No | Keep `false` until SMTP delivery is implemented |
| `SMTP_HOST` | When email is enabled | SMTP server hostname |
| `SMTP_PORT` | When email is enabled | Usually `587` |
| `SMTP_SECURE` | When email is enabled | `true` for implicit TLS, otherwise `false` |
| `SMTP_USER` | When email is enabled | SMTP username |
| `SMTP_PASSWORD` | When email is enabled | SMTP password |
| `SMTP_FROM` | When email is enabled | Sender name and address |
| `CRON_SECRET` | When email is enabled | Secret for the future outbox delivery endpoint |

Generate secrets with a password manager or `openssl rand -base64 48`. Do not commit `.env` files.

## Deploy on Coolify

This repository is designed for one production environment. Keep automatic deployment disabled for the first release; deploy manually after each verified change.

1. Create a PostgreSQL resource in the same Coolify project.
2. Add this GitHub repository as an application and select the `main` branch.
3. Choose Nixpacks. The repository pins Node.js 22 in `nixpacks.toml`.
4. Set port `3000` and health-check path `/api/health`.
5. Add the production environment variables above. Use the database's private/internal URL.
6. Deploy the application.
7. Open the application terminal and run:

   ```sh
   npm run db:deploy
   npm run db:seed
   ```

8. Restart the application and sign in with `SEED_ADMIN_CODE` and `SEED_ADMIN_PASSWORD`.

The seed is idempotent. In production it only creates or restores the configured super-admin account. After the first successful seed, remove `SEED_ADMIN_PASSWORD` from Coolify unless another seed run is required.

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

## Current boundary

This first deployable base intentionally stops before HR content authoring, CSV employee import, learning playback/progress mutation, quiz submission, and SMTP delivery. Their tables and environment boundary are present; those workflows should be built and tested as the next vertical slices.
