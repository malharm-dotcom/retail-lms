# Retail LMS Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a tested, production-deployable LMS foundation with authentication, RBAC, relational domain schema, seeded data, role-specific desktop dashboards, and Coolify documentation.

**Architecture:** One Next.js 14 App Router service uses Prisma 7 with the PostgreSQL driver adapter. NextAuth credentials authenticate employee codes; every protected server query re-reads the active User row. The first milestone is read-only after seed, leaving content mutations and tracking for the next plan.

**Tech Stack:** Next.js 14, React 18, TypeScript 5, Prisma 7, PostgreSQL, NextAuth 4, bcryptjs, Tailwind CSS 3, Vitest, Nixpacks.

**Spec:** `docs/superpowers/specs/2026-09-25-retail-lms-foundation-design.md`

## Global Constraints

- Desktop-first editorial operations UI; no generic dashboard kit or additional component library.
- Employee code plus password; no public registration.
- Every employee-facing data read derives the employee id from the active server session.
- Published content versions are immutable and assignments create one Enrollment per employee.
- PostgreSQL dates remain calendar dates; timestamps store UTC and display IST.
- Production migrations are never executed automatically by the application start command.
- Run `npm run typecheck`, `npm test`, and `npm run build` before push.

## Review Focus

- Unknown or inactive employee code must fail authentication without revealing which condition occurred.
- An employee cannot reach HR routes or query another employee's enrollment.
- An HR admin and super-admin land on the HR dashboard; an employee lands on My Learning.
- Empty databases render zero-state dashboards instead of throwing.
- Missing required production secrets fail closed with a clear server-side error.

---

### Task 1: Project and domain foundation

**Files:** Create project configuration, `.env.example`, `nixpacks.toml`, `prisma/schema.prisma`, `prisma.config.ts`, `prisma/seed.ts`, `src/lib/progress.ts`; test `src/lib/progress.test.ts`.

**Interfaces:** Produces `deriveEnrollmentStatus(requiredLessonCount, completedLessonCount, quizPassed, acknowledgementRequired, acknowledged)` and all Prisma models consumed later.

- [ ] Write `progress.test.ts` first with literal cases for not started, in progress, blocked by quiz, blocked by acknowledgement, and completed.
- [ ] Run `npm test -- src/lib/progress.test.ts`; expect failure because `progress.ts` does not exist.
- [ ] Add the minimal status derivation and Prisma schema described by the spec.
- [ ] Run the test and `npm run typecheck`; expect both to pass.
- [ ] Commit as `feat: establish LMS domain foundation`.

### Task 2: Authentication and RBAC

**Files:** Create `src/lib/auth.ts`, `src/lib/session.ts`, `src/lib/rbac.ts`, `src/lib/db.ts`, auth route, middleware, and login UI; test `src/lib/rbac.test.ts`.

**Interfaces:** Consumes Prisma `User` and `Role`; produces `homeForRole(role)`, `canAccessAdmin(role)`, `currentUserOrNull()`, and `requireCurrentUser()`.

- [ ] Write RBAC tests first for employee denial and HR/super-admin access and landing paths.
- [ ] Run the focused test; expect failure because `rbac.ts` does not exist.
- [ ] Implement NextAuth employee-code credentials, active-row session refresh, RBAC, middleware, and login UI.
- [ ] Run focused tests, full tests, and typecheck; expect all to pass.
- [ ] Commit as `feat: add employee authentication and RBAC`.

### Task 3: Role-specific desktop dashboards

**Files:** Create root layout/styles, protected pages, `src/components/app-shell.tsx`, `src/components/stat-card.tsx`, `src/components/sign-out-button.tsx`, and `src/lib/dashboard.ts`; test `src/lib/dashboard.test.ts`.

**Interfaces:** Consumes current-user and Prisma interfaces; produces `getEmployeeDashboard(userId)` and `getAdminDashboard()` for server pages.

- [ ] Write dashboard aggregation tests first using pure status counts and hand-derived expected totals.
- [ ] Run the focused test; expect failure because `dashboard.ts` does not exist.
- [ ] Implement aggregation, server queries, employee overview, HR overview, and zero states.
- [ ] Run focused tests, full tests, typecheck, and build; expect all to pass.
- [ ] Commit as `feat: add LMS dashboard foundation`.

### Task 4: Deployment contract and final verification

**Files:** Create `src/app/api/health/route.ts`, `src/lib/health.ts`, and `README.md`; modify environment and package configuration; test `src/lib/health.test.ts`.

**Interfaces:** Consumes database configuration; produces `/api/health`, Coolify setup instructions, migration/seed procedure, and SMTP variable contract.

- [ ] Add a health payload test for configured/unconfigured database status before the helper exists.
- [ ] Implement the health helper and route without opening a database connection.
- [ ] Document production-only Coolify deployment, manual `prisma migrate deploy`, seed behavior, backup requirement, and SMTP/outbox variables.
- [ ] Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`; expect zero failures.
- [ ] Self-review the full diff against the spec and remove unrequested code.
- [ ] Commit as `docs: add Coolify deployment contract` and push `main` to `origin`.
