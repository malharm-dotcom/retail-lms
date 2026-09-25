# Retail LMS foundation design

## Outcome

Build a desktop-first internal LMS for Snitch retail employees. Employees sign in with an employee code and password, complete individually assigned training, and leave auditable progress, quiz, and policy-acknowledgement records. HR administers users, content, assignments, and reports.

## Locked decisions

- Next.js App Router, TypeScript, Prisma 7, PostgreSQL, and Coolify/Nixpacks.
- One production Coolify environment; deploys remain manual until backup and restore are proven.
- Desktop browser is the primary interface. Responsive behavior remains usable but is not the design driver.
- Employee identity is employee code plus password. There is no public registration.
- User master begins as HR-managed CSV import; HRMS integration is deferred.
- Content types are YouTube video, PDF, and rich text. Native PowerPoint rendering is excluded.
- Mandatory video completion requires 95% unique watched coverage. Compliance completion also requires the configured quiz and policy acknowledgement.
- Assignments may target all employees, a store, a department, or an individual, but always materialize one Enrollment per employee.
- English only.
- Email is SMTP-backed. Assignment and reminder delivery will use a PostgreSQL outbox processed by a protected scheduled endpoint; no Redis or worker service.

## First milestone

The first pushed version is a deployable foundation, not the full LMS authoring system. It contains:

- application and deployment configuration;
- the complete initial relational schema;
- employee-code authentication and server-enforced RBAC;
- seeded super-admin and employee accounts plus representative learning data;
- desktop employee and HR dashboard shells backed by PostgreSQL;
- a health endpoint and a documented Coolify environment contract.

Content authoring, assignment mutations, video heartbeat tracking, quiz submission, CSV import, SMTP outbox processing, and reporting exports are subsequent milestones built on these interfaces.

## Roles and access

- `EMPLOYEE`: sees only their own enrollments and progress.
- `HR_ADMIN`: sees all users, modules, assignments, and aggregate progress; cannot grant `SUPER_ADMIN`.
- `SUPER_ADMIN`: HR access plus role and system administration.

Middleware is only the coarse redirect layer. Every server read and mutation re-reads the active User row and enforces the role and employee scope server-side.

## Data model

- Organization: `Store`, `Department`, `User`.
- Versioned content: `TrainingModule`, immutable published `ModuleVersion`, `Section`, `Lesson`, `Asset`.
- Assessment: `Quiz`, `Question`, `QuestionOption`, `QuizAttempt`.
- Distribution: `Assignment` and individual `Enrollment` rows.
- Evidence: `LessonProgress`, `Acknowledgement`, and append-only `AuditEvent`.
- Notifications: `EmailOutbox` with pending/sent/failed state and retry metadata.

Published ModuleVersions are immutable. Assignments reference a version, so later edits cannot rewrite what an employee completed. Mandatory status and due date belong to Assignment, not TrainingModule.

## UX direction

The interface is an editorial operations console: warm paper background, ink text, rust accent, condensed display headings, precise rules, and dense but readable tables. It avoids gradients, glass effects, oversized cards, chat patterns, and decorative AI-style elements.

Employee navigation: Overview, My learning, Completed. HR navigation: Overview, Modules, Assignments, People, Reports. The first milestone implements role-aware overview pages and exposes inactive navigation items as clearly labelled upcoming work rather than fake functionality.

## Environment contract

Required in production:

- `DATABASE_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET` (at least 32 characters)
- `APP_DEPLOY_ENV=production`
- `SEED_ADMIN_CODE`, `SEED_ADMIN_NAME`, `SEED_ADMIN_PASSWORD`

Optional until email delivery is enabled:

- `EMAIL_ENABLED=false`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`
- `CRON_SECRET`
- `APP_BASE_URL`

## Risks and mitigations

- Production-only deployment: production deploy remains manual; migrations are reviewed and applied explicitly before an app deployment.
- Scope leakage: enrollment queries derive the employee id from the active session and never accept a client employee id.
- Completion fraud: completion will accumulate unique watched intervals server-side; timestamps sent by the browser are never treated as proof on their own.
- Content drift: assignments reference immutable ModuleVersions.
- Email failure: transactional writes create outbox rows; SMTP failure cannot roll back or partially complete an assignment.
- Calendar dates: due dates are PostgreSQL `date` values and display as calendar dates without timezone conversion. Timestamps remain UTC and display in IST.
- User removal: users are deactivated, not deleted, so history remains intact.

## Explicitly excluded from the first milestone

Public registration, mobile app/PWA, offline downloads, SCORM/xAPI, certificates, leaderboards, payments, communities, native PowerPoint conversion, first-party video transcoding, WhatsApp notifications, and automatic HRMS synchronization.
