# 01. Project Brief: Veyro

**Document Version:** 1.5.2 (Final Downgrade Selection Clarification)  
**Phase:** Phase 1 — Product Discovery & MVP Definition  
**Status:** PHASE 1 APPROVED — READY FOR PHASE 2 (Approved on October 11, 2026)  
**Architecture:** Modular Monolith (NestJS + Next.js + PostgreSQL + Prisma)

---

## 1. Executive Summary & Product Vision

### 1.1 Vision
**Veyro** is a modern, reliable, and production-oriented multi-tenant Project Management SaaS. It is engineered to help teams organize, track, and execute collaborative work without the cognitive overload, bloat, and enterprise friction typical of legacy project management platforms.

### 1.2 Core Philosophy
1. **Clarity over Complexity:** Prioritize predictable, rock-solid core project and task workflows over bloated feature sets.
2. **Strict Multi-Tenancy & Account Hierarchy:** Conceptual model structured as `User → Account → Workspaces → Projects → Tasks`. The **Account** serves as the ownership, billing, and subscription boundary. The **Workspace** serves as the collaborative working environment. Data isolation enforces strict boundaries preventing cross-workspace and cross-account data leaks. (Database schema optimization scoped by tenant identifiers; concrete schema changes deferred to Phase 2).
3. **Architectural Simplicity:** Built as a **Modular Monolith** to maximize development velocity, maintainability, and operational simplicity while avoiding premature microservices distribution.
4. **Decoupled User & Workspace Lifecycle:** User registration establishes global identity independently. A User can access Veyro AI (Knowledge Mode) immediately without creating or joining any Workspace. Workspace creation or joining is a separate, deliberate onboarding step.
5. **Context-Aware, Controlled AI Assistance:** Dual-mode AI Assistant providing public product knowledge (RAG) and private project insights with confirmed write operations (project/task creation and updates) backed by strict pre-LLM authorization, explicit user confirmation, and atomic backend execution.

---

## 2. Problem Statement

Modern software, agency, and business teams struggle with two opposite extremes in project tooling:
1. **Bloated Enterprise Suites:** Complex configuration, noisy interfaces, slow page loads, and features (complex Gantt charts, heavy automation engines, complex billing structures) that small-to-medium teams never utilize.
2. **Trivial To-Do Trackers:** Lack proper multi-tenancy, granular organization boundaries, project-level permissions, audit history, and structured task states needed for professional delivery.

**Veyro bridges this gap:** An agile, fast, intuitive multi-tenant workspace where organizations manage their projects, track task lifecycles, assign work, monitor change history with confidence, and query operational data through a grounded, secure AI assistant.

---

## 3. Target Audience & Personas

| Persona | Role | Primary Goals & Needs | Frustrations |
| :--- | :--- | :--- | :--- |
| **Account Owner (Founder / Agency Lead)** | Account Owner | Account billing management, subscription tiers, manage Account Workspaces, overarching administrative oversight across all owned Workspaces. | Accidental cross-tenant data leaks, confusing role setups, convoluted administrative panels. |
| **Workspace Admin / Project Manager** | Workspace Admin / Project Lead | Create projects, structure task backlogs, assign tickets, set deadlines, track status transitions, manage workspace members. | Unreliable task status sync, missing audit logs for changes, difficulty managing project-level access. |
| **Team Member / Contributor** | Workspace Member / Project Member | Clear view of assigned tasks, update ticket status, comment, view deadlines, track personal workload; zero visibility into unassigned workspaces or private projects. | Cluttered UI, notifications spam, unintuitive navigation. |

---

## 4. Key Use Cases

1. **User Registration & Immediate AI Access:** A user registers an individual account. The user immediately has access to the Veyro AI Knowledge Assistant within their personal daily quota without being required to create or join a Workspace.
2. **Decoupled Account & Workspace Onboarding:** An authenticated user can create an Account and Workspace (becoming Account Owner) or join an existing Workspace via a secure, Workspace-scoped invitation link.
3. **Multi-Account & Multi-Workspace Participation:** A single user (one global identity) can belong to multiple Accounts and Workspaces (e.g., employer, client agency, side project) and switch active workspace contexts seamlessly. Personal AI quotas apply across all authorized contexts.
4. **Subscription & Capacity Management:** Account Owners manage Account subscriptions (governing workspace and aggregate project limits) with a 7-day payment grace period and safe read-only project downgrades. Users manage personal AI subscriptions.
5. **Private & Scoped Project Management:** Workspace Admins and Account Owners create projects within an authorized Workspace. Projects are private by default; Workspace Members only access projects to which they are assigned.
6. **Task Execution & Collaboration:** Team members create tasks, assign work, set due dates and priorities, post comments, and advance tasks through a strictly enforced lifecycle state machine (`TODO` → `IN_PROGRESS` → `IN_REVIEW` → `DONE`, with structured cancellation and reopening paths).
7. **Activity & Audit Tracking:** Members view an immutable trail of updates on projects and tasks to see who changed what, when, and why.
8. **Veyro AI Assistance:**
   - **Knowledge Assistance (RAG):** Users ask questions about Veyro features, workflows, and policies, receiving grounded answers with documentation citations (read-only, no workspace required).
   - **Workspace Project Assistance:** Authenticated users query accessible project status, deadlines, and blockers, or request the AI to create/update projects and tasks subject to explicit user confirmation and atomic backend execution.

---

## 5. Measurable Goals & Success Criteria

### 5.1 Product & Business Goals (MVP)
- **Time to First Project:** An onboarded user can create an organization and publish their first project in less than 2 minutes.
- **Workflow Reliability:** 100% test pass rate on authorization, tenant isolation, and task state transitions.
- **Operational Simplicity:** Deployable as a single backend container and a single frontend container with PostgreSQL.

### 5.2 Technical Success Metrics & Benchmark Conditions
- **Tenant Isolation Integrity:** 0% cross-tenant data bleed in automated multi-tenant integration tests, including direct API queries, database relations, and AI retrieval pipelines.
- **API Response Times (p95 < 150ms):**
  - **Metric Definition:** Server-side request processing duration (from request receipt in NestJS to response payload flush, including Prisma execution and PostgreSQL round-trip). Client-to-server internet transit and DNS lookup are excluded.
  - **Endpoint Scope:** Core authenticated CRUD endpoints (`GET /api/projects`, `GET /api/projects/:id/tasks`, `POST /api/projects/:id/tasks`, `PATCH /api/tasks/:id`). (Note: External LLM generation streaming is excluded from this 150ms CRUD target and tracked separately).
  - **Benchmark Load Conditions:** Measured under sustained load of 100 concurrent virtual users / 500 requests per minute (RPM).
  - **Infrastructure Baseline:** Backend API and PostgreSQL co-located in the same cloud region/VPC (sub-millisecond internal wire latency), with a warmed connection pool (cold-start initialization excluded) and standard composite indexes applied (`organizationId`, `id`).
- **Test Coverage:** Automated unit and integration test coverage for all authorization guards, tenant scoping interceptors, business rule validations, and AI pre-retrieval authorization filters.

---

## 6. MVP Scope & Boundaries

To ensure rapid delivery, high quality, and architectural sanity, strict scope boundaries are enforced for Phase 1 and the initial MVP build.

### 6.1 In-Scope (MVP Core Workflows)
- **Authentication & Identity:**
  - User registration, login, secure session management using NestJS-native JWT with HTTP-only cookies.
  - Refresh token rotation with hashed storage (SHA-256) in the database.
  - Decoupled onboarding: Signup creates the user identity only; workspace creation/joining occurs as a subsequent step.
- **Multi-Tenant Account & Workspace Management:**
  - Conceptual hierarchy: `User → Account → Workspaces → Projects → Tasks`.
  - Account creation: User creates an Account (becoming Account Owner).
  - Workspace creation: Restricted to Account Owner and authorized Workspace Admins; ordinary Members cannot create Workspaces by default.
  - Member invitations: Scoped to a specific Workspace (`workspaceId`). An invitation to one Workspace never grants access to other Workspaces within the Account.
  - Invitation security: SHA-256 hashed secret tokens (never exposed in logs), 7-day expiration, single-use with atomic race protection, revokable, and strict target email matching upon acceptance.
  - Roles: Account Owner (Account billing and workspace governance); Workspace Admin (workspace-level management); Workspace Member (project-level contributor).
- **Project Management:**
  - Create, view, update, archive projects within an authorized Workspace (Restricted to Owners and Admins).
  - Private project access model: Standard Workspace Members access only assigned projects; Owners/Admins retain administrative visibility across projects in their authorized scope.
- **Task Management:**
  - Create, update, view, and soft-delete tasks within accessible projects.
  - Properties: Title, Description (Markdown), Status (`TODO`, `IN_PROGRESS`, `IN_REVIEW`, `DONE`, `CANCELLED`), Priority (`LOW`, `MEDIUM`, `HIGH`, `URGENT`), Assignee, Due Date.
  - Assignment validation: Assignee must belong to both the workspace and the parent project.
  - Reopening governance: Reopening a `DONE` or `CANCELLED` task restricted to Author or Admin with a mandatory reason comment.
- **Task Collaboration:**
  - Chronological comments on tasks with author attribution.
- **Activity Log & Audit Trail:**
  - Automatic append-only event logging for critical mutations (status changes, reassignments, member role changes, task soft deletion/restoration, and purge events).
- **Hybrid Deletion & Lifecycle Management:**
  - Archival for Projects and Workspaces (read-only preservation, reversible).
  - Soft deletion for Tasks (`deletedAt = NOW()`) with a **30-day recovery window**.
  - Automated reliable scheduled purge process to permanently delete tasks and child comments after 30 days without external queue or Redis dependencies, protected against concurrent multi-instance execution via PostgreSQL advisory locks.
  - Permanent cascading deletion strictly reserved for explicit Owner/Admin purge actions.
- **Subscription & Entitlement Management:**
  - **Personal AI Subscription (per User):**
    - Free: 3 messages/day; Pro: 15 messages/day; Enterprise: 25 messages/day; Epic: 50 messages/day.
    - Quota belongs strictly to User identity and applies across all authorized contexts; resets daily at `00:00 UTC`.
    - AI access does not require creating or joining a Workspace.
    - Paid AI subscriptions renew monthly in MVP (exact monetary prices are `TBD`).
    - **Payment Failure & 7-Day Grace Period:** When renewal payment fails, the AI subscription enters `Past Due` with a 7-day grace period where the User retains their current AI plan and its daily quota.
    - **Downgrade to Free:** If payment remains unsuccessful after grace, the User's AI plan falls back to `Free` (3 msgs/day). Downgrading an AI subscription never deletes the User's account, project data, or conversation records.
    - **Manual Cancellation:** Manual cancellation does not immediately remove paid benefits; they remain active until the end of the already-paid period, transitioning to Free thereafter unless renewed.
    - **Payment Activation:** Subscription becomes Active only after trusted server-side payment confirmation (webhook), not frontend redirect.
    - **Decoupled Lifecycles:** The Personal AI Subscription lifecycle does not alter Account Workspace or Project limits. Account subscription changes do not alter User personal AI quotas.
  - **Account Workspace Subscription (per Account):**
    - Free: 1 Workspace, 3 Projects across Account.
    - Pro: 3 Workspaces, 7 Projects across Account.
    - Enterprise: 10 Workspaces, 15 Projects across Account.
    - Epic: Unlimited Workspaces, 25 Projects across Account.
    - Aggregate project capacity across all Workspaces in the Account. Archived projects count toward limit; soft-deleted do not. Empty workspaces consume 0 project slots. Moving a project between workspaces in same Account does not change aggregate count. Restoring soft-deleted project requires available capacity (blocked if limit exceeded until capacity freed or upgrade).
    - Paid plans are monthly in MVP; exact monetary prices are `TBD`.
  - **Account Subscription Lifecycle & Grace Period:**
    - Failed payment enters `Past Due` with a 7-day grace period (plan benefits continue, cannot exceed limits).
    - If unpaid after grace, Account is restricted to Free limits (max 1 Workspace, max 3 Projects across Account).
    - **Zero Automatic Data Deletion:** No Projects or Project data are ever deleted due to a downgrade.
    - **Explicit Owner Project Selection:** The Account Owner must explicitly select up to 3 Projects to remain editable under the Free limit. The system shall **never** automatically select the three most recently updated Projects or select any Projects using another implicit rule.
    - **Temporary Read-Only Hold for All Projects:** Until the Owner completes this selection, **all Projects in that Account remain temporarily Read-only**.
    - **Post-Selection State:** After the Owner confirms the selection, only the selected eligible Projects may become editable, subject to their existing lifecycle state and permissions. All unselected Projects remain Read-only.
    - **Distinct State Separation (`Read-only` vs `Archived` vs `Soft-deleted`):** `Read-only` is an access tier constraint due to subscription limits, distinct from `Archived` (voluntary freeze) or `Soft-deleted` (trash). Archived Projects remain Archived; selecting an archived Project does not automatically unarchive it. Soft-deleted projects remain soft-deleted.
    - **Partial Selection (<3 Projects):** If the Owner selects fewer than 3 Projects, only the selected Projects become eligible for editing; the system does not fill unused slots automatically.
    - **Upgrade Reactivation:** A later upgrade does not automatically reactivate Projects that became Read-only. The Owner must explicitly select which Projects to reactivate within the new plan's limits.
    - Subscription activation requires trusted backend payment confirmation (webhook), not frontend redirect.
  - **AI Message Consumption & Confirmation Invariants:**
    - A successfully generated AI response or change proposal consumes exactly 1 AI message from the User's daily quota.
    - This message is consumed even if the User reviews and rejects the proposal.
    - Clicking Confirm to execute an already-generated proposal does not consume an AI message (0 additional messages deducted), as it requires no new AI generation. Ordinary UI interactions and executing approved proposals never count as new AI messages.
    - Upstream technical failures (timeouts, gateway errors) preventing a usable response or proposal do not consume quota. Internal retries for the same request never double-charge.
- **Veyro AI Assistant Scope:**
  - **Mode A (Knowledge Assistant — RAG):** Public product documentation Q&A, citations, grounded answers, read-only. Accessible to any registered user with or without a Workspace.
  - **Mode B (Workspace Project Assistant):** Context-aware operational Q&A + Confirmed Write Operations:
    - *Permitted Project Writes:* Create Project, update Project `Name` and `Description`.
    - *Permitted Task Writes:* Create Task, update Task `Title`, `Description`, `Status`, `Assignee`, `Due Date`, `Priority`.
    - *Prohibited Writes:* Delete Projects/Tasks; Archive/Unarchive Projects; Create/Edit Comments; Change memberships, roles, or permissions.
    - *Approval Flow:* Structured proposal → User reviews in UI (consumes 1 AI message upon successful generation, even if rejected) → User explicitly confirms → Backend revalidates permissions, limits, and business rules (consumes 0 additional AI messages) → Atomic execution (all-or-nothing for related changes in single operation) → UI reports actual outcome.

### 6.2 Explicitly Out-of-Scope (Deferred Post-MVP)
The following capabilities are explicitly omitted from the MVP:
- ❌ **Autonomous AI Mutations Without Confirmation:** AI cannot bypass user review, cannot delete projects/tasks, cannot archive/unarchive, cannot create/edit comments, cannot mutate memberships/permissions.
- ❌ **Cross-Account Project Transfer:** Moving projects between distinct billing Accounts is deferred post-MVP.
- ❌ **Annual Billing & Concrete Payment Vendor Bindings:** Multi-year or annual billing plans and concrete payment gateway lock-in (Stripe/LemonSqueezy) are deferred to technical implementation. Exact prices are `TBD`.
- ❌ **Microservices Architecture:** Strictly modular monolith. No distributed RPC, no independent service deployments.
- ❌ **External Message Queues & Distributed Caches:** No RabbitMQ/Kafka/Redis pub-sub in MVP. Scheduled cleanups and background logic run via standard transactional in-process scheduling in NestJS.
- ❌ **Complex Real-time Collaboration:** No operational transforms, CRDTs, or canvas editors. Standard REST/HTTP with optimistic UI or SWR revalidation.
- ❌ **Enterprise SSO & SAML:** No Okta, SAML 2.0, or LDAP integrations.
- ❌ **Gantt Charts & Custom Fields:** Fixed task schema only.
- ❌ **File Attachments / S3 Buckets:** Text/Markdown only in initial MVP.

---

## 7. Functional Requirements (FR)

### Module 1: Auth & User Identity (`identity`)
- **FR-1.1:** System shall permit users to register with name, unique email (normalized: trimmed, lowercase), and secure password (bcrypt/argon2).
- **FR-1.2:** System shall verify credentials and issue short-lived access tokens via secure HTTP-only cookies and store hashed refresh tokens in the database.
- **FR-1.3:** System shall provide token refresh with single-use rotation and reuse compromise detection.
- **FR-1.4:** System shall permit users to update their profile (name, profile picture placeholder).
- **FR-1.5:** Registration shall NOT automatically create an organization; new users without an org are directed to an onboarding gateway (Create Workspace or Join Workspace).

### Module 2: Account & Workspace Management (`tenancy`)
- **FR-2.1:** Any authenticated user can create an Account, automatically becoming its Account Owner.
- **FR-2.2:** Account Owners and authorized Workspace Admins can create Workspaces under an Account; ordinary Workspace Members cannot create Workspaces by default.
- **FR-2.3:** Each Workspace is assigned a unique slug, name, and internal UUID identifier.
- **FR-2.4:** Admins and Owners can invite new members to a specific Workspace (`workspaceId`) by email with a designated Workspace role (`ADMIN` or `MEMBER`).
- **FR-2.5:** System shall generate a copyable invitation link without requiring an active external email service. If configured, an email adapter shall dispatch the invite.
- **FR-2.6:** Invitation tokens shall be stored as SHA-256 hashes, expire after 7 days, be single-use (protected against concurrent race conditions), and be revokable prior to acceptance.
- **FR-2.7:** Accepting an invitation requires the authenticated user's email to match the normalized recipient email on the invitation. Acceptance grants access solely to the target Workspace.
- **FR-2.8:** Users can switch active workspace contexts across multiple Accounts and Workspaces without re-authenticating.
- **FR-2.9:** Account Owners can transfer Account ownership to an existing Workspace Admin or Member.

### Module 3: Projects (`projects`)
- **FR-3.1:** Only Workspace Admins and Account Owners can create projects under an authorized Workspace.
- **FR-3.2:** Projects must have a name, optional description, and lifecycle status (`ACTIVE`, `ARCHIVED`).
- **FR-3.3:** Projects are private by default; Workspace Members can only access projects where they have explicit project membership.
- **FR-3.4:** Account Owners and Workspace Admins possess administrative access to view and manage all projects within their authorized Workspace scope.
- **FR-3.5:** Admins and Owners can assign or remove workspace members from projects.

### Module 4: Tasks (`tasks`)
- **FR-4.1:** Assigned project members (plus Admins/Owners) can create tasks within active projects.
- **FR-4.2:** Tasks have a title (required), description, status, priority, due date, and assignee.
- **FR-4.3:** Task status transitions must follow a strictly validated state machine.
- **FR-4.4:** Assignee must be an active member of the containing project.
- **FR-4.5:** Reopening a task (`DONE → IN_PROGRESS` or `CANCELLED → TODO`) is restricted to the Task Author or an Admin/Owner and requires a mandatory non-empty reason.
- **FR-4.6:** Tasks can be soft-deleted (`deletedAt = NOW()`), hiding them from active boards.
- **FR-4.7:** Soft-deleted tasks can be restored within a 30-day recovery window; tasks older than 30 days are permanently purged by an idempotent, safe scheduled cleanup job.

### Module 5: Collaboration & Audit (`activity`)
- **FR-5.1:** Project members can post comments on tasks.
- **FR-5.2:** Authors can edit or delete their own comments (soft-masked).
- **FR-5.3:** System must record an immutable activity trail for significant task mutations (status change, reassignment, priority update, task reopening reasons, soft-deletion, restoration, and permanent purges).

### Module 6: Veyro AI Assistant (`ai`) — Dual-Mode Scope
- **FR-6.1:** System shall provide an interactive AI chat interface within the application for authenticated users. Access to Knowledge Mode does not require a Workspace.
- **FR-6.2 (Knowledge Mode — Shared Public Corpus):** Assistant shall answer questions regarding Veyro platform features, navigation, and workflows based on an approved, unprivileged shared public documentation corpus, including citations. Knowledge Mode is strictly read-only.
- **FR-6.3 (Project Mode — Tenant Workspace Corpus):** Assistant shall answer factual operational questions regarding projects, tasks, assignees, deadlines, and progress. Context is scoped strictly to the active workspace (`workspaceId`). For Account Owners and Workspace Admins, context encompasses all projects in the workspace; for standard Workspace Members, context is restricted strictly to projects where active `ProjectMembership` exists.
- **FR-6.4 (Pre-LLM Authorization):** System shall enforce all user permissions and tenant boundaries server-side in the database retrieval step *before* supplying context to the language model. The LLM is never an authorization boundary.
- **FR-6.5 (Grounded Truth & Fallback):** When insufficient context exists, the assistant shall explicitly state that evidence is unavailable rather than fabricating information.
- **FR-6.6 (Project Mode Confirmed Write Operations):** Assistant shall support proposing mutations for authorized users:
  - *Projects:* Create Project; update Project `Name` and `Description`.
  - *Tasks:* Create Task; update Task `Title`, `Description`, `Status`, `Assignee`, `Due Date`, `Priority`.
- **FR-6.7 (Prohibited AI Mutations):** Assistant is strictly prohibited from deleting Projects or Tasks, archiving/unarchiving Projects, creating/editing Comments, changing memberships/roles/permissions, or executing unapproved operations.
- **FR-6.8 (Mutation Proposal & User Confirmation Flow):** All write operations require a structured change proposal presented in the UI, explicit user confirmation, and server-side revalidation of current permissions, membership, project status, subscription capacity, and business rules at execution time. Successfully generating the proposal consumes exactly 1 AI message from the User's daily quota (even if the user rejects the proposal); confirming and executing the proposal consumes 0 additional AI messages. Related changes within a single approved operation must succeed entirely or produce no partial persisted changes.
- **FR-6.9 (Untrusted Data Isolation):** Retrieved database records and user queries shall be strictly quarantined as untrusted data blocks (`<untrusted_context>`) in prompt assembly to mitigate prompt injection.
- **FR-6.10 (Data Privacy & External Provider Verification):** Customer workspace data must strictly not be used for model training under any circumstances. The LLM integration shall use a provider-agnostic adapter, with concrete provider selection deferred to the implementation phase. Before onboarding any provider, engineering must review its actual contractual retention periods, logging, deletion, subprocessors, and DPA terms. Zero data retention must not be assumed without verified contractual evidence. Context sent to external LLMs shall omit credentials, session tokens, passwords, or unassigned project data.

### Module 7: Subscriptions & Entitlements (`billing`)
- **FR-7.1 (Personal AI Subscriptions):** Personal AI Subscriptions apply per User across all authorized contexts (Free: 3, Pro: 15, Enterprise: 25, Epic: 50 messages/day). Quotas reset daily at `00:00 UTC` and do not require a Workspace.
- **FR-7.2 (AI Quota Accounting & Proposal Consumption):** Each successfully generated AI response or change proposal consumes exactly 1 message from the daily quota, even if the user reviews and rejects the proposal. Confirming and executing an already-generated proposal does not consume an additional AI message. Ordinary UI interactions do not count as AI messages. Technical upstream failures (e.g., timeouts) do not consume quota. Internal retries must not double-charge. Quota exhaustion blocks further requests with reset time and upgrade CTA.
- **FR-7.3 (Account Workspace Subscriptions):** Account Subscriptions govern Workspace and Project capacity across an Account: Free (1 WS / 3 Projects), Pro (3 WS / 7 Projects), Enterprise (10 WS / 15 Projects), Epic (Unlimited WS / 25 Projects). Limits apply in aggregate across all Workspaces in the Account.
- **FR-7.4 (Project Capacity Rules):** Active and archived Projects count toward the Project limit. Soft-deleted Projects and empty Workspaces consume no Project slots. Moving a Project between Workspaces within the same Account does not alter aggregate count.
- **FR-7.5 (Restoration Capacity Check):** Restoring a soft-deleted Project requires an available Project slot; restoration is blocked if the Account has reached its limit.
- **FR-7.6 (Payment Failure & Grace Period):** Failed payments transition Account to `Past Due` with a 7-day grace period where current benefits continue but capacity cannot be expanded.
- **FR-7.7 (Downgrade to Free & Project Selection Invariants):** After 7-day grace expiration without payment, the Account is restricted to Free limits (max 1 Workspace, max 3 Projects across Account). Zero automatic data deletion: no Projects or task records are deleted. The Account Owner must explicitly select up to 3 Projects to remain editable under the Free limit. The system shall never automatically choose Projects via implicit rules (e.g., most recently updated). Until the Owner completes this selection, all Projects in that Account remain temporarily `Read-only`. After selection confirmation, only selected eligible Projects become editable, subject to their existing lifecycle state and permissions; unselected Projects remain `Read-only`. If the Owner selects fewer than 3 Projects, only the selected Projects become editable (unused slots are not auto-filled). Archived Projects remain `Archived` (selecting an archived Project does not auto-unarchive it).
- **FR-7.8 (Upgrade Reactivation & Payment Confirmation):** Upgrading an Account does not automatically unlock read-only Projects; the Owner must manually select which Projects to reactivate within the new capacity. Paid status activates strictly upon trusted payment confirmation (webhook), not client-side redirect. Paid plans are monthly in MVP; exact prices are `TBD`.
- **FR-7.9 (Personal AI Subscription Lifecycle & Independence):** Paid AI subscriptions renew monthly in MVP. When renewal payment fails, the AI subscription enters `Past Due` with a 7-day grace period maintaining full current plan quota. If payment remains unsuccessful after grace, the user falls back to `Free` tier (3 msgs/day). Downgrading never deletes user accounts, project data, or conversation records. Manual cancellation preserves paid benefits until the billing period ends. Active status requires trusted server-side payment confirmation (webhook). The Personal AI Subscription lifecycle is completely decoupled from Account Workspace and Project limits, and Account plan changes do not alter User personal AI quotas.

---

## 8. Non-Functional Requirements (NFR)

### 8.1 Security & Multi-Tenant Data Isolation
- **NFR-1.1 (Tenant Isolation Defense-in-Depth):** Tenant boundaries are enforced through layered defenses:
  1. *API Guard Layer:* NestJS Tenant Guards validate active workspace membership.
  2. *Query Scoping Layer:* Prisma Client Extensions automatically inject tenant filters on all queries.
  3. *Query Performance Optimization:* Compound indexes `(workspaceId, id)` optimize tenant-filtered lookups. (Note: Indexes optimize query execution paths and are not an authorization or security boundary).
  4. *Alternative Query Ban:* Raw database query bypasses (`$queryRaw`) without explicit tenant scoping are strictly prohibited in application code.
  5. *Future Database Engine Hardening:* PostgreSQL Row-Level Security (RLS) is cataloged as a potential future infrastructure-level defense-in-depth layer.
  6. *Automated Testing Requirements:* CI/CD specifications must mandate automated integration tests specifically asserting cross-tenant IDOR rejection, unassigned project containment, and raw SQL query prohibition before release.
- **NFR-1.2 (Authorization):** Role-based access control (RBAC) must be enforced at the API controller layer via NestJS Guards before business logic executes.
- **NFR-1.3 (Credential & Token Safety):** Passwords hashed using bcrypt/argon2; refresh tokens hashed (SHA-256) before database persistence; session cookies configured with `HttpOnly`, `Secure`, and `SameSite` flags. Raw invitation and refresh tokens are strictly omitted from application logs.
- **NFR-1.4 (CSRF Defense):** Comprehensive CSRF mitigation combining `SameSite` cookie attributes, strict origin/referer validation, and custom request header verification (`X-Requested-With` or `X-Veyro-Client`) on all state-mutating HTTP methods.
- **NFR-1.5 (AI Security & Privacy):** AI context construction must never expose cross-tenant data. User prompts, conversation history, and retrieval artifacts must be isolated per tenant and scrubbed of raw secrets. External LLM calls must comply with strict tenant privacy standards.

### 8.2 Architecture & Maintainability
- **NFR-2.1 (Modular Monolith):** The backend NestJS codebase must enforce strict module boundaries (`IdentityModule`, `AccountModule`, `WorkspaceModule`, `ProjectModule`, `TaskModule`, `ActivityModule`, `AiModule`, `BillingModule`).
- **NFR-2.2 (Domain Isolation):** Modules communicate through explicit service interfaces, not by direct database queries into other domains' tables.

### 8.3 Performance & Reliability
- **NFR-3.1 (Latency Target):** p95 server processing response time < 150ms for core CRUD operations under 100 concurrent users / 500 RPM baseline conditions (see Section 5.2). AI streaming responses are tracked under distinct time-to-first-token (TTFT) metrics. (Target specification to be verified during Phase 4 load testing).
- **NFR-3.2 (Atomic Transactions & Distributed Purge Safety):** State changes involving multiple entities must execute inside atomic database transactions (`prisma.$transaction`). Scheduled cleanup tasks in multi-instance deployments must use transaction-level PostgreSQL advisory locks (`pg_try_advisory_xact_lock`) within bounded transactional batches (e.g., LIMIT 500) to guarantee singleton execution without Redis and prevent lock stranding across transaction connection poolers (PgBouncer / Neon / Supabase).

### 8.4 Observability
- **NFR-4.1 (Structured Logging):** Backend logs formatted with request IDs, user IDs, and workspace context. Sensitive tokens, credentials, and full LLM prompts are strictly redacted.

---

## 9. Baseline Decision Status & AI Architecture

All foundational product and technical architecture decisions have agreed directions:
- **DEC-01 through DEC-11:** `APPROVED` (Branding, Shared DB Multi-tenancy, NestJS Auth, Copyable Invites, Private Projects, Hybrid Deletion, Admin Project Creation, Decoupled Onboarding, Strict Email Match, Task Reopening Governance, 30-Day Purge).
- **DEC-12 (AI Assistant Vector Storage & Retrieval Strategy):** `APPROVED (DIRECTIONAL)` — Architectural direction: PostgreSQL + `pgvector`. Subject to verifying support on the selected hosting platform (Neon/Supabase) and benchmarking retrieval performance before implementation. *(Status: NOT RUN — scheduled for implementation phase)*.
- **DEC-13 (External LLM Provider Integration & Data Privacy Policy):** `APPROVED (DIRECTIONAL)` — Architectural direction: Commercial LLM API via provider-agnostic adapter. Concrete provider selection is deferred to implementation. Customer data must strictly not be used for model training; actual provider retention, logging, deletion, subprocessors, and DPA terms must be verified prior to selection without assuming Zero Data Retention.
- **DEC-14 (Product Conceptual Hierarchy & Ownership Boundary):** `APPROVED` — Structure defined as `User → Account → Workspaces → Projects → Tasks`. The Account is the billing and multi-workspace boundary; Workspace is the collaborative environment; User is the global identity.
- **DEC-15 (Personal AI Subscription Tiers & Daily Message Quotas):** `APPROVED` — Personal quotas (Free: 3, Pro: 15, Enterprise: 25, Epic: 50 msgs/day), resetting daily at 00:00 UTC. Independent of Workspaces. Technical failures do not consume quota.
- **DEC-16 (Account Workspace Subscriptions & Capacity Lifecycle):** `APPROVED` — Account-level limits (Free: 1 WS / 3 Projects; Pro: 3 WS / 7 Projects; Enterprise: 10 WS / 15 Projects; Epic: Unl WS / 25 Projects across Account). Aggregate project counts; 7-day payment grace period; Free-plan downgrade holds all projects temporarily Read-only until Owner explicitly selects up to 3 editable projects (no implicit auto-selection); zero data deletion; archived projects remain archived; partial selections respected; manual reactivation required on later upgrade. Monthly billing; exact prices TBD.
- **DEC-17 (Veyro AI Assistant Confirmed Write Operations in Project Mode):** `APPROVED` — Permitted writes for Project (create, update name/description) and Task (create, update title/desc/status/assignee/due date/priority). Prohibits deletions, archival, comments, and permissions.
- **DEC-18 (AI Mutation Proposal & User Confirmation Flow):** `APPROVED` — Structured proposal, explicit user confirmation, backend permission revalidation, and atomic all-or-nothing execution.
- **DEC-19 (Workspace-Scoped Invitations & Isolation):** `APPROVED` — Invitations target a specific Workspace and grant access solely to that Workspace.
- **DEC-20 (Cross-Account Project Transfer Scope):** `DEFERRED POST-MVP` — Moving projects between distinct billing Accounts is deferred to a future phase.
- **DEC-21 (Commercial Pricing & Payment Gateway Selection):** `TBD / DEFERRED` — Exact monetary pricing and payment provider integration choices are deferred to technical implementation.
- **DEC-22 (Personal AI Subscription Payment Failure, Grace Period, and Cancellation Lifecycle):** `APPROVED` — Paid AI subscriptions renew monthly in MVP; renewal payment failure enters `Past Due` with a 7-day grace period maintaining full plan quota; unpaid after grace downgrades to Free (3 msgs/day) with zero deletion of user account, project data, or conversation history; manual cancellation preserves benefits until billing period ends; activation requires trusted server payment confirmation; strictly decoupled from Account Workspace/Project limits.
- **DEC-23 (AI Message Consumption for Proposals and Confirmation):** `APPROVED` — A successfully generated AI response or change proposal consumes exactly 1 AI message, even if rejected; confirming/executing an already-generated proposal consumes 0 additional messages; technical failures do not consume quota; internal retries never double-charge; backend revalidation and atomic all-or-nothing execution enforced on confirmation.

*Note: Phase 1 is a documentation and requirements specification baseline. Performance targets (e.g., p95 < 150ms), hosting pgvector verification, and security test suites represent specification acceptance criteria for implementation and runtime verification during Phase 2 and Phase 4, not verified test runs.*
