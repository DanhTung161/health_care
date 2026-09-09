<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Healthcare Management System — Codex Project Instructions

## 1. Project Context

This repository is a Healthcare Management System built with:

- Next.js 16
- App Router
- TypeScript
- Tailwind CSS
- MongoDB
- Mongoose
- Custom JWT authentication
- Role-Based Access Control (RBAC)

Authentication uses:

- JWT signed by the authentication implementation
- HTTP-only cookie: `auth_token`
- JWT payload:
  - `userId`
  - `email`
  - `role`
- Supported roles:
  - `ADMIN`
  - `DOCTOR`
  - `STAFF`

The current middleware is the source of truth for route protection and RBAC behavior.

Do not introduce Better Auth, NextAuth/Auth.js, Clerk, Supabase Auth,
or another authentication system unless explicitly requested.

MongoDB is the real application data source.
Do not replace existing database-backed flows with mock or hard-coded data
unless explicitly requested.


## 2. Source of Truth

Never assume the repository matches common Next.js examples,
older documentation, previous Next.js versions, or conventional project structures.

Use this priority order:

1. Existing repository code
2. Repository instructions (`AGENTS.md`)
3. Installed Next.js documentation in `node_modules/next/dist/docs/`
4. Existing project conventions
5. External/general knowledge only when necessary

Before modifying a feature, inspect its actual implementation and dependencies.

Do not assume a model, API route, utility, component, type, service,
or directory exists because its name would be conventional.

For example, do not assume a `Doctor.ts` model exists.
Inspect the current data model first.


## 3. Next.js 16 Rules

This project uses Next.js 16.

Before implementing or changing behavior that depends on Next.js APIs,
routing, rendering, caching, middleware/proxy behavior, request APIs,
Server Components, Client Components, Route Handlers, or configuration:

1. Read the relevant documentation from:
   `node_modules/next/dist/docs/`
2. Check deprecation notices.
3. Follow the APIs and conventions of the installed Next.js version.
4. Do not rely on remembered behavior from older Next.js versions.

Do not downgrade Next.js or rewrite working Next.js 16 patterns to older
patterns unless explicitly requested.


## 4. Inspect Before Editing

For every implementation task:

1. Read this `AGENTS.md`.
2. Identify the smallest relevant feature scope.
3. Inspect the existing implementation.
4. Inspect directly related imports and dependencies.
5. Inspect the relevant Mongoose models before changing database behavior.
6. Inspect the relevant API Route Handlers before changing frontend data flows.
7. Inspect authentication/RBAC before changing protected routes or APIs.
8. Then implement the smallest coherent change.

Do not start by scanning or rewriting the entire repository unless the task
actually requires repository-wide analysis.

Do not guess missing implementation details.


## 5. Architecture Boundaries

Preserve the existing architecture unless the task explicitly requires
an architectural change.

Current responsibilities are generally:

- `src/app/`
  - App Router pages, layouts and Route Handlers

- `src/app/(admin)/`
  - authenticated management UI

- `src/app/(auth)/`
  - authentication UI

- `src/app/(client)/`
  - public/client-facing UI

- `src/app/api/`
  - backend HTTP endpoints

- `src/components/`
  - reusable React UI

- `src/components/admin/`
  - admin-specific UI

- `src/components/auth/`
  - authentication-specific UI

- `src/components/client/`
  - client-facing UI

- `src/components/shared/`
  - cross-feature shared components

- `src/components/ui/`
  - reusable UI primitives

- `src/context/`
  - React context/state used across UI

- `src/lib/`
  - infrastructure and shared utilities

- `src/models/`
  - Mongoose schemas/models

- `src/middleware.ts`
  - authentication and RBAC route protection

Prefer extending existing patterns over creating parallel abstractions.


## 6. Authentication and Authorization

Treat authentication and authorization as security-sensitive.

Before modifying auth-related behavior, inspect at minimum:

- `src/middleware.ts`
- relevant auth Route Handlers
- relevant User model/schema
- callers of the affected auth behavior

Never trust a role supplied by the browser/client.

Authorization must be enforced server-side.

UI visibility is not authorization.

When adding or modifying a protected API or page, verify whether access
should differ between:

- `ADMIN`
- `DOCTOR`
- `STAFF`

Do not weaken existing authorization as a side effect of implementing
another feature.

Do not expose JWT secrets, authentication tokens, passwords,
password hashes, or sensitive environment variables to client code,
logs, responses, or committed files.


## 7. Database Rules

Before changing database behavior:

1. Inspect the actual Mongoose schema/model.
2. Inspect existing API usage of that model.
3. Preserve existing field naming and relationships unless a migration
   or schema change is explicitly required.

Do not invent schema fields.

Do not silently change existing field semantics.

Avoid destructive database operations unless explicitly requested.

If a requested change requires a schema migration or could invalidate
existing MongoDB documents, report that impact before treating the task
as complete.


## 8. API Rules

Keep Route Handlers focused and consistent with existing repository patterns.

For API changes:

- validate and normalize untrusted input
- return appropriate HTTP status codes
- preserve existing response contracts unless intentionally changing them
- handle expected errors
- enforce authentication and authorization server-side
- never rely solely on frontend validation

Before changing an API response shape, inspect its consumers.


## 9. TypeScript Rules

Maintain strong TypeScript safety.

- Avoid `any` unless there is a concrete reason.
- Prefer narrowing `unknown`.
- Reuse existing types when appropriate.
- Keep server-only and client-safe types/code separated.
- Do not suppress TypeScript errors simply to make the build pass.
- Do not add `@ts-ignore` or unsafe casts unless unavoidable and justified.

When changing a shared type or schema, inspect its consumers first.


## 10. React and UI Rules

Preserve the existing visual language and Tailwind conventions.

Before creating a new component:

1. Search `src/components/ui/`
2. Search `src/components/shared/`
3. Search feature-specific components

Reuse or extend an existing component when appropriate.

Do not introduce a new UI framework, styling system, icon library,
or state-management library unless explicitly requested.

Prefer Server Components where appropriate.

Use Client Components only when client-side interactivity, browser APIs,
React state/effects, or other client-only behavior requires them.

Do not add `"use client"` merely to work around an architecture problem.


## 11. Scope Control

Make the smallest change that fully solves the requested task.

Do not:

- perform unrelated refactors
- rename unrelated files
- reformat unrelated code
- replace working architecture without a requirement
- install unnecessary dependencies
- rewrite neighboring features merely for consistency
- modify generated files

If you discover an unrelated issue, mention it separately instead of
silently expanding the task.


## 12. Dependency Rules

Before installing a package:

1. Check whether the repository already has a suitable dependency.
2. Check whether the task can be solved cleanly with existing platform APIs.
3. Confirm the package is actually necessary.

Do not install dependencies merely for convenience.

Do not upgrade unrelated packages during a feature or bug-fix task.


## 13. Environment and Secrets

Never expose or commit secrets from `.env.local`.

Do not print secret values in logs or final reports.

When environment configuration is required, refer to variable names only,
for example:

- `MONGODB_URI`
- `JWT_SECRET`

Do not replace real secrets with committed hard-coded values.


## 14. Verification

After making changes, run the narrowest useful verification first.

Where applicable:

1. Run lint/checks relevant to changed files.
2. Run TypeScript validation.
3. Run relevant tests if they exist.
4. Run the project build when appropriate for the scope.

Use scripts defined in `package.json`; inspect them instead of assuming
script names.

Do not claim a command passed unless it was actually executed successfully.

If verification cannot be completed, clearly state:

- what was not verified
- why
- what remains to be checked


## 15. Completion Report

At the end of an implementation task, provide a concise report containing:

1. What changed
2. Important files changed
3. Verification performed
4. Any remaining risks, assumptions, or follow-up work

Do not produce a long tutorial unless explicitly requested.


## 16. General Working Principle

Inspect → Understand → Implement → Verify → Report.

Prefer evidence from the repository over assumptions.

When uncertain about implementation details, inspect the relevant code
instead of guessing.

When the requested task is clear enough to proceed safely, proceed without
asking unnecessary questions.