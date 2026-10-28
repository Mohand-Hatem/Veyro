<div align="center">

# ⚡ Veyro

**Production-Grade Multi-Tenant Workspace & Project Management Platform**

*Engineered as a Modular Monolith with NestJS 11, Prisma 7, Neon Serverless PostgreSQL, and Next.js 16 App Router.*

[![NestJS](https://img.shields.io/badge/Backend-NestJS%2011-ea2845?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2016%20App%20Router-black?logo=next.js&logoColor=white)](https://nextjs.org/)
[![Prisma](https://img.shields.io/badge/ORM-Prisma%207-2d3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/Database-Neon%20PostgreSQL-00e599?logo=postgresql&logoColor=black)](https://neon.tech/)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript%205-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

</div>

---

## 📌 Overview

**Veyro** is an agile, multi-tenant workspace and project management platform built to provide modern product, agency, and engineering teams with enterprise-grade reliability without cognitive overload or software bloat.

Instead of navigating bloated legacy enterprise suites or dealing with primitive to-do lists that lack tenant isolation, Veyro provides structured task lifecycles, defense-in-depth multi-tenancy, granular RBAC, immutable audit logging, and a context-aware AI assistant equipped with strict pre-LLM authorization and human-in-the-loop mutation confirmation.

---

## 🏗️ Architecture & Core Principles

Veyro is built following strict software engineering and systems architecture discipline:

1. **Modular Monolith Discipline:**  
   Avoids premature microservices complexity. The backend is structured into clear, encapsulated NestJS domain modules communicating through well-defined internal boundaries and unified data models.
2. **Contract-First & Backend-First Implementation:**  
   Every REST API endpoint, DTO, guard, and sequence flow is thoroughly documented and implemented against real PostgreSQL persistence before frontend integration. Zero reliance on synthetic mock data.
3. **Decoupled User & Tenant Hierarchy:**  
   Identity is global, while collaboration is scoped:
   $$\text{User} \longrightarrow \text{Account (Billing/Owner Boundary)} \longrightarrow \text{Workspaces} \longrightarrow \text{Projects} \longrightarrow \text{Tasks}$$
   A user can exist and utilize personal AI knowledge capabilities without belonging to any workspace.
4. **Defense-in-Depth Multi-Tenancy:**  
   Every query and mutation strictly enforces `organizationId` and `workspaceId` boundaries. Private projects return **`404 Not Found`** instead of `403 Forbidden` to prevent resource enumeration attacks (`BR-PRJ-01`).
5. **Idempotent & Transactional Operations:**  
   Atomic DB transactions (`prisma.$transaction`) ensure zero orphan records during multi-step processes like atomic onboarding, cascade task unassignment, and payment webhook deduplication.

---

## 🚀 Key Modules & Capabilities (Backend 100% Completed)

### 1. 🔐 Authentication & Session Security (`AuthModule`)
- **Dual Token Architecture:** Short-lived access JWTs paired with long-lived cryptographically secure refresh tokens stored in `HttpOnly`, `SameSite=Strict` cookies.
- **Refresh Token Family Rotation (`BR-AUTH-02`):** Immediate revocation of entire token families upon reuse detection to prevent replay and session hijacking attacks.
- **Social OAuth 2.0:** Google and GitHub sign-in that accepts only a provider-verified email, a one-use `state` check against login CSRF, and a pre-hijacking defence (a provider claiming an unverified local account replaces its password and ends its sessions).
- **Hardened by default:** the server refuses to start without a strong `JWT_SECRET`, tokens travel only in cookies, and the sign-in, registration, code and reset routes are rate limited per IP.

### 2. 🏢 Tenancy & Workspace Management (`TenancyModule`)
- **Atomic Onboarding:** Transactional account creation, initial workspace provisioning, and owner role assignment in a single request (`POST /api/v1/onboarding/atomic`).
- **Cryptographic Workspace Invitations (`DEC-09`):** Target-email-locked invitations using SHA-256 token hashing, expiration validation, and idempotent acceptance.

### 3. 📁 Projects & Access Governance (`ProjectsModule`)
- **Private Project Privacy (`BR-PRJ-01`):** Projects are private by default; non-assigned workspace members receive anti-enumeration `404 Not Found` responses.
- **Tier-Based Project Limits (`BR-SUB-02`):** Strictly enforced active project caps across accounts (`Free: 3`, `Pro: 7`, `Enterprise: 15`, `Epic: 25`).
- **Cascade Task Unassignment (`BR-TSK-03.4`):** Removing a project member automatically unassigns their pending tasks while preserving task history and audit trail.

### 4. ✅ Tasks & State Machine Lifecycle (`TasksModule`)
- **5-State Finite State Machine (FSM):** Guaranteed valid transitions between `TODO`, `IN_PROGRESS`, `IN_REVIEW`, `DONE`, and `CANCELLED`.
- **Dedicated Reopening Gate:** Completed tasks cannot be reopened via standard edit endpoints; they require a dedicated request (`POST /api/v1/tasks/:id/reopen`) with a mandatory audit reason (minimum 5 characters) and author attribution.
- **Assignee Project Validation (`BR-TSK-03.2`):** Tasks can only be assigned to verified members of the parent project.

### 5. 🤖 AI Assistant with Safe Mutations (`AiModule`)
- **Dual Scoped Modes:** `KNOWLEDGE` mode (global platform RAG) vs `PROJECT` mode (scoped workspace/project insights).
- **Two-Phase Quota Reservation:** Prevents LLM quota exhaustion races via atomic quota reservation (`PENDING` $\rightarrow$ `FINALIZED` or `COMPENSATED`).
- **Human-in-the-Loop Mutation Proposals (`AiMutationProposal`, `BR-AI-01`):** AI cannot directly write to projects or tasks; it generates structured mutation proposals that require explicit user confirmation.
- **Zero-Cost Confirmations (`DEC-23`):** Executing an approved proposal incurs zero additional AI quota.
- **A real model with grounded answers:** Google Gemini answers from the Veyro help documents (pgvector similarity search, with cited sources) and reads the workspace through read-only tools that only see what the signed-in person may see. The user and workspace come from the server, never from the model, and tool results are treated as data, not instructions. Off-topic or injected requests get a fixed refusal.
- **Plan-based daily limits:** Free 3, Pro 15, Enterprise 25 and Epic 50 messages a day (the best plan among the accounts a person owns).

### 6. 💳 Billing, Webhooks & Grace Periods (`BillingModule`)
- **Signed, idempotent webhooks:** every Stripe event is verified (HMAC-SHA256 over the timestamp and raw body, 5-minute tolerance) before anything happens, the current subscription is re-read from Stripe so out-of-order events are safe, and events are deduplicated in `billing_events` by `externalEventId`.
- **Checkout, customer portal and plan switching:** Stripe Checkout for a new plan, the Stripe customer portal for cards and cancellation, and prorated switches between paid plans. Stripe runs in **test mode only** (a portfolio project: no real payments).
- **7-Day Payment Grace Period:** Grace period support before account project freezing occurs.
- **Downgrade Recalibration (`BR-SUB-03`):** When an account downgrades to Free, all projects freeze; the Account Owner can select up to 3 active projects (`POST /api/v1/accounts/:id/select-active-projects`).

### 7. 📜 Audit Logging (`AuditModule`)
- **Tenant-Scoped Activity Trail:** Paginated, immutable audit logs tracking actions, actor identity, target resources, and before/after metadata snapshots.

### 8. 🔔 Notifications (`NotificationsModule`)
- **Written with the event:** an assignment, a comment on your task, being added to a project, a role change and an accepted invitation each create a notification inside the same transaction as the event and its audit row, so they exist together or not at all. Nobody is notified about their own action, and only people still in the workspace are.
- **Private by construction:** the endpoints never take a user id; every query is scoped to the caller, marking someone else's notification is a `404`, and notifications from a workspace you left are hidden. A paged list (keyset cursor), an unread count, mark one and mark all read.
- **Delivery:** the bell polls the unread count once a minute while the tab is visible. The sentence is built on screen from the type and a copied snapshot of the data, so it follows the page language.

### 9. 🖼️ Profile Pictures (`UsersModule`, `StorageModule`)
- **Server-side processing:** the browser crops, then sends the picture as the request body. The server decodes it for real, rotates it upright, crops a square, **strips all metadata** (location and camera data never leave the server) and stores only a 256 px WebP (about 10 to 30 KB) in Cloudinary. Inputs are limited to 2 MB and JPEG, PNG or WebP.
- **Defaults and choices:** every account has initials at once; a person can pick one of five illustrated avatars or upload a photo. Google and GitHub photos are used as they are.
- **Soft delete:** removing a stored photo hides it (private delivery, so its address stops working) and keeps it for 30 days; a retention purge deletes it for good. The schedule for that job arrives with deployment (Phase 6).

### 10. ✉️ Email (`EmailModule`)
- Verification codes, password reset, invitations and the contact form send through Resend with plain `fetch` (no SDK). Sending is never awaited and never throws, so it cannot leak whether an address exists. Production refuses the Resend test sender, so a verified domain is needed before deploying.

---

## 🗄️ Database Architecture & Data Model

Veyro's persistence layer is engineered with **Prisma 7** and **PostgreSQL 16+** on **Neon Serverless Database**, utilizing the `@prisma/adapter-pg` driver adapter.

```mermaid
erDiagram
    User ||--o{ AccountMember : "belongs to"
    User ||--o{ WorkspaceMember : "collaborates in"
    User ||--o{ RefreshToken : "owns"
    User ||--o{ AiConversation : "participates in"
    Account ||--o{ AccountMember : "has"
    Account ||--o{ Workspace : "contains"
    Account ||--o{ Subscription : "billed for"
    Workspace ||--o{ WorkspaceMember : "has members"
    Workspace ||--o{ Project : "contains"
    Workspace ||--o{ WorkspaceInvitation : "issues"
    Project ||--o{ ProjectMember : "assigned members"
    Project ||--o{ Task : "tracks"
    Task ||--o{ TaskComment : "has discussion"
    Task ||--o{ TaskActivityLog : "records changes"
```

- **25 Prisma models** (the source of truth is `backend/prisma/schema.prisma`; the diagram above shows the core relationships): `User`, `UserSession`, `UserOtpVerification`, `UserPasswordResetToken`, `Account`, `Workspace`, `WorkspaceMember`, `WorkspaceInvitation`, `WorkspaceInvitationProject`, `Project`, `ProjectMember`, `Task`, `TaskComment`, `AccountSubscription`, `UserAiSubscription`, `BillingEvent`, `AiDailyUsage`, `AiUsageReservation`, `AiConversation`, `AiMessage`, `AiMutationProposal`, `AuditLog`, `ContactMessage`, `KnowledgeChunk` (pgvector embeddings of the help documents) and `Notification`.
- **Primary Keys:** Collision-resistant CUID2 identifiers (`@default(cuid())`).
- **Indexes:** Composite indexes optimized for multi-tenant filtering (`[workspaceId, status]`, `[projectId, status]`, `[accountId, createdAt]`).

---

## 🗺️ Project Phase Roadmap

| Phase | Description | Deliverables | Status |
| :---: | :--- | :--- | :---: |
| **Phase 1** | **Product Discovery & MVP Baseline** | `docs/01-PROJECT-BRIEF.md`, `02-USER-ROLES-AND-FLOWS.md`, `03-BUSINESS-RULES.md` | ✅ **Completed (`v1.5.2`)** |
| **Phase 2** | **System Design & API Contracts** | ERD (`04-ERD.md`), Physical DB Spec (`05-DB.md`), OpenAPI Contracts (`06-API.md`), Sequence Diagrams | ✅ **Completed (100%)** |
| **Phase 3** | **NestJS Backend Implementation** | 7 Modular Monolith modules, Prisma 7, Neon DB migration, Guards, Interceptors, Filters | ✅ **Completed (100%)** |
| **Phase 4** | **Frontend Development & Design Gate** | `design.md` baseline, Next.js 16 App Router app in `frontend/` (English and Arabic, light and dark), every screen checked against its reference with parity scripts | ✅ **Completed** |
| **Phase 5** | **Integration, Security & Quality** | Security hardening, a tenant-isolation and role matrix, query and reliability fixes, real email (Resend), Google and GitHub sign-in, Stripe (test mode), a real AI assistant (Gemini and help-document search), profile pictures (Cloudinary and sharp) and notifications, with automated tests for each | ✅ **Completed** |
| **Phase 6** | **Deployment, CI/CD & Portfolio** | Docker containerization, Vercel & Neon staging/prod environments, Monitoring | ⚪ *Planned* |

---

## 🛠️ Tech Stack

- **Backend:** [NestJS 11](https://nestjs.com/) (TypeScript, Express platform, Class Validator, Passport)
- **Database & ORM:** [PostgreSQL 16+](https://www.postgresql.org/) via [Neon](https://neon.tech/), [Prisma ORM 7](https://www.prisma.io/) with `@prisma/adapter-pg`
- **Frontend:** [Next.js 16 App Router](https://nextjs.org/) with React 19, [Tailwind CSS 4](https://tailwindcss.com/), [Radix UI](https://www.radix-ui.com/) through [shadcn/ui](https://ui.shadcn.com/), [TanStack Query](https://tanstack.com/query), [next-intl](https://next-intl.dev/) (English and Arabic, right-to-left), react-hook-form with zod, next-themes
- **Security:** Bcrypt password hashing, SHA-256 invitation tokens, HttpOnly JWT cookies, rate limiting, strict RBAC guards, signed webhooks, OAuth `state`
- **Integrations:** Resend (email), Google and GitHub OAuth, Stripe (test mode), Google Gemini (answers and embeddings, searched with pgvector), Cloudinary (profile pictures) with sharp (server-side image processing)

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20.x or higher
- npm or pnpm
- A running PostgreSQL database or Neon Cloud project

### 1. Clone the Repository
```bash
git clone https://github.com/Mohand-Hatem/Veyro.git
cd Veyro
```

### 2. Configure Environment Variables
Each app owns its environment file; there is no root `.env`.
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```
Edit `backend/.env` and set your database connection:
```env
DATABASE_URL="postgresql://user:password@ep-sample.neon.tech/veyro?sslmode=require"
JWT_SECRET="your-super-secure-jwt-secret-min-32-chars"
```
`frontend/.env.local` only needs `API_ORIGIN` (where the backend listens) and the OAuth switch; the defaults work locally.

Every external service is optional in development and documented in `backend/.env.example` (Resend, Google and GitHub OAuth, Stripe test keys, Gemini, Cloudinary). Without a key the feature degrades honestly: emails are skipped (or printed with `DEV_OUTBOX=true`), the assistant answers with a fixed stand-in text, photo upload reports that it is not set up, and payments report not configured. Production refuses to start without them. `DATABASE_URL_Branch` (optional) points development and tests at a Neon branch while `DATABASE_URL` stays production.

### 3. Install Dependencies
```bash
cd backend && npm install
cd ../frontend && npm install
```

### 4. Apply the Database Migrations
```bash
cd backend
# Applies the SQL in backend/prisma/migrations to your PostgreSQL / Neon database
npx prisma migrate deploy
```

### 5. Load the Help Documents (only for the assistant)
```bash
cd backend
npm run knowledge:ingest   # embeds backend/knowledge/*.md into pgvector (needs GEMINI_API_KEY)
```

### 6. Start the Backend
```bash
cd backend
npm run start:dev
```
The NestJS API runs at `http://localhost:5000/api/v1`.

### 7. Start the Frontend
```bash
cd frontend
npm run dev
```
The app runs at `http://localhost:3000` (English at `/en`, Arabic at `/ar`). It calls the API through `/api/v1`, which Next.js forwards to the backend, so the session cookies stay first-party.

---

## ✅ Tests and Checks

| Where | Command | What it covers |
| :--- | :--- | :--- |
| `backend/` | `npm test` | 31 test files, 359 tests of the business rules, role rules, tenant isolation (a route-by-route matrix that fails when a new route is not classified), plan limits, security, email, OAuth, Stripe (signed webhooks), the AI gateway, help search and tools, avatars and notifications, plus journey tests across the whole product. They run against the database in `DATABASE_URL_Branch` (or `DATABASE_URL`) and create and remove their own data. A suite can be cancelled when the database connection drops while it sets up; run it again. |
| `backend/` | `npm run ai:eval` | The assistant's question set (22 cases: help answers, refusals, workspace data, prompt injection, task drafts) against the real model on the development branch; it refuses to run on production. |
| `backend/` | `npx tsc --noEmit` | Type check |
| `frontend/` | `npm test` | 127 unit tests (vitest): API client, validation, helpers, initials and crop math, notification helpers, message coverage in both languages |
| `frontend/` | `npm run lint`, `npx tsc --noEmit`, `npm run build` | Lint, types and the production build |
| `frontend/` | `node scripts/parity/run.mjs scripts/parity/<screen>.js` | Parity check of one screen against its reference page: computed styles, layout and text at 1440 and 390 px wide, light and dark, English and Arabic. The reference pages live in `screens/`, which is kept locally and is not part of this repository. Each script's header lists what it needs (Playwright with Chrome, the running servers and its test data). |

Automated CI/CD and a browser end-to-end suite are not set up yet; both are planned for Phase 6. The browser flows were checked by hand with Playwright, including the real upload, payment and notification flows.

---

## 🖥️ What Is Built

- **Account and access:** sign in (email, Google, GitHub), registration with email code, password reset, onboarding, invitations, profile and preferences, profile photo (upload with a crop step, one of five illustrated avatars, or initials)
- **Workspace:** dashboard, projects, my tasks, project board with task lifecycle and reopening with a reason, task page with comments, members and settings, audit trail, creating more workspaces within the plan limit
- **Account governance:** billing and plans, choosing which projects stay editable after a downgrade, account deletion, account audit trail
- **AI assistant:** a full page and a quick-ask drawer; it answers from the help documents and your workspace data, shows its sources, and proposes a change that is only written after you confirm it
- **Notifications:** the bell with an unread count and a popover (assignments, comments, project additions, role changes, accepted invitations), in English and Arabic
- **Help and public site:** how it works guide, contact form, landing page, 404, 403 and error states

**Needs your own accounts to run live:** email (Resend; the test sender is for testing only), Google and GitHub sign-in, Stripe (test mode), Gemini and Cloudinary. Their keys go in the gitignored `backend/.env`, never in the repository.

**Not built yet (planned for Phase 6 or later):** CI/CD and deployment, scheduled jobs (the 30-day removed-photo purge and notification cleanup), a browser end-to-end suite, email or push notifications, @mentions, and deleting a person's user record.

---

## 🧪 Core API Endpoints Overview

| Method | Endpoint | Description | Guard / Protection |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/register` | Register new user identity | Public |
| `POST` | `/api/v1/auth/login` | Authenticate and issue JWT cookies | Public |
| `POST` | `/api/v1/onboarding/atomic` | Atomic creation of Account + Workspace | `JwtAuthGuard` |
| `POST` | `/api/v1/workspaces/:id/invitations`| Invite member with SHA-256 token | `JwtAuthGuard`, `TenantGuard` |
| `GET` | `/api/v1/workspaces/:workspaceId/projects` | List accessible workspace projects | `JwtAuthGuard`, `TenantGuard` |
| `GET` | `/api/v1/projects/:id` | Get project details (404 for private) | `ProjectAccessGuard` (`BR-PRJ-01`) |
| `POST` | `/api/v1/projects/:projectId/tasks` | Create task within project (project admins) | `ProjectAccessGuard` |
| `POST` | `/api/v1/tasks/:id/reopen` | Reopen task with mandatory reason | `TaskAccessGuard` (`BR-TSK-03.3`) |
| `POST` | `/api/v1/ai/conversations` | Start AI session (Knowledge/Project) | `JwtAuthGuard` |
| `POST` | `/api/v1/billing/webhook` | Stripe webhook: signature verified, current state re-read, deduplicated | Public (HMAC signature required) |
| `PUT` | `/api/v1/users/me/avatar` | Upload a profile picture (raw body, validated and re-encoded by the server) | `JwtAuthGuard`, rate limited |
| `GET` | `/api/v1/notifications` | The caller's notifications, newest first, paged | `JwtAuthGuard` (own rows only) |
| `GET` | `/api/v1/audit-logs` | Retrieve tenant audit trail | `TenantGuard`, `AccountOwnerGuard` |

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">
  <sub>Built with engineering excellence by <strong>Mohand Hatem</strong></sub>
</div>
