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
- **Social OAuth 2.0:** Passport strategies prepared for Google and GitHub SSO.

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

### 6. 💳 Billing, Webhooks & Grace Periods (`BillingModule`)
- **Stripe Webhook Idempotency:** Webhook event deduplication via database event logging (`billing_events`) keyed by `externalEventId`.
- **7-Day Payment Grace Period:** Grace period support before account project freezing occurs.
- **Downgrade Recalibration (`BR-SUB-03`):** When an account downgrades to Free, all projects freeze; the Account Owner can select up to 3 active projects (`POST /api/v1/accounts/:id/select-active-projects`).

### 7. 📜 Audit Logging (`AuditModule`)
- **Tenant-Scoped Activity Trail:** Paginated, immutable audit logs tracking actions, actor identity, target resources, and before/after metadata snapshots.

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

- **19 Physical 3NF Models:** `users`, `accounts`, `account_members`, `workspaces`, `workspace_members`, `workspace_invitations`, `projects`, `project_members`, `tasks`, `task_comments`, `task_activity_logs`, `subscriptions`, `ai_subscriptions`, `ai_conversations`, `ai_messages`, `ai_usage_reservations`, `ai_mutation_proposals`, `billing_events`, `audit_logs`.
- **Primary Keys:** Collision-resistant CUID2 identifiers (`@default(cuid())`).
- **Indexes:** Composite indexes optimized for multi-tenant filtering (`[workspaceId, status]`, `[projectId, status]`, `[accountId, createdAt]`).

---

## 🗺️ Project Phase Roadmap

| Phase | Description | Deliverables | Status |
| :---: | :--- | :--- | :---: |
| **Phase 1** | **Product Discovery & MVP Baseline** | `docs/01-PROJECT-BRIEF.md`, `02-USER-ROLES-AND-FLOWS.md`, `03-BUSINESS-RULES.md` | ✅ **Completed (`v1.5.2`)** |
| **Phase 2** | **System Design & API Contracts** | ERD (`04-ERD.md`), Physical DB Spec (`05-DB.md`), OpenAPI Contracts (`06-API.md`), Sequence Diagrams | ✅ **Completed (100%)** |
| **Phase 3** | **NestJS Backend Implementation** | 7 Modular Monolith modules, Prisma 7, Neon DB migration, Guards, Interceptors, Filters | ✅ **Completed (100%)** |
| **Phase 4** | **Frontend Development & Design Gate** | `design.md` baseline, Next.js 16 App Router, Tailwind CSS, Shadcn/ui, TypeUI MCP, Kanban Board | 🟡 **Active (Design Gate)** |
| **Phase 5** | **Integration, Security & E2E Testing** | Multi-tenant penetration tests, Stripe & OAuth live testing, Jest/Supertest suite | ⚪ *Planned* |
| **Phase 6** | **Deployment, CI/CD & Portfolio** | Docker containerization, Vercel & Neon staging/prod environments, Monitoring | ⚪ *Planned* |

---

## 🛠️ Tech Stack

- **Backend:** [NestJS 11](https://nestjs.com/) (TypeScript, Express platform, Class Validator, Passport)
- **Database & ORM:** [PostgreSQL 16+](https://www.postgresql.org/) via [Neon](https://neon.tech/), [Prisma ORM 7](https://www.prisma.io/) with `@prisma/adapter-pg`
- **Frontend (Phase 4):** [Next.js 16 App Router](https://nextjs.org/), [Tailwind CSS](https://tailwindcss.com/), [Shadcn/ui](https://ui.shadcn.com/) (Radix UI primitives), [TypeUI MCP](https://mcp.typeui.sh/mcp)
- **Security:** Argon2/Bcrypt password hashing, SHA-256 invitation tokens, HttpOnly JWT cookies, Rate limiting, Strict RBAC guards

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
Copy the environment template and provide your database credentials:
```bash
cp .env.example .env
cp .env.example backend/.env
```
Edit `.env` and set your database connection:
```env
DATABASE_URL="postgresql://user:password@ep-sample.neon.tech/veyro?sslmode=require"
JWT_SECRET="your-super-secure-jwt-secret-min-32-chars"
```

### 3. Install Dependencies
```bash
cd backend
npm install
```

### 4. Sync Database Schema
```bash
# Push Prisma schema to your PostgreSQL / Neon database
npx prisma db push
```

### 5. Start the Backend Development Server
```bash
npm run start:dev
```
The NestJS API will be running at `http://localhost:3000/api/v1`.

---

## 🧪 Core API Endpoints Overview

| Method | Endpoint | Description | Guard / Protection |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/register` | Register new user identity | Public |
| `POST` | `/api/v1/auth/login` | Authenticate and issue JWT cookies | Public |
| `POST` | `/api/v1/onboarding/atomic` | Atomic creation of Account + Workspace | `JwtAuthGuard` |
| `POST` | `/api/v1/workspaces/:id/invitations`| Invite member with SHA-256 token | `JwtAuthGuard`, `TenantGuard` |
| `GET` | `/api/v1/projects` | List accessible workspace projects | `JwtAuthGuard`, `TenantGuard` |
| `GET` | `/api/v1/projects/:id` | Get project details (404 for private) | `ProjectAccessGuard` (`BR-PRJ-01`) |
| `POST` | `/api/v1/tasks` | Create task within project | `ProjectAccessGuard` |
| `POST` | `/api/v1/tasks/:id/reopen` | Reopen task with mandatory reason | `TaskAccessGuard` (`BR-TSK-03.3`) |
| `POST` | `/api/v1/ai/conversations` | Start AI session (Knowledge/Project) | `JwtAuthGuard` |
| `POST` | `/api/v1/billing/webhook` | Deduplicated Stripe payment webhook | Public (Signature Verified) |
| `GET` | `/api/v1/audit-logs` | Retrieve tenant audit trail | `TenantGuard`, `AccountOwnerGuard` |

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">
  <sub>Built with engineering excellence by <strong>Mohand Hatem</strong></sub>
</div>
