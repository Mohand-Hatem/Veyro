# Architectural & Product Decisions: Veyro

**Document Version:** 1.5.2 (Final Downgrade Selection Clarification)  
**Phase:** Phase 1 — Product Discovery & MVP Definition  
**Status:** PHASE 1 APPROVED — READY FOR PHASE 2 (Approved on October 11, 2026)  
**Parent Document:** [`01-PROJECT-BRIEF.md`](./01-PROJECT-BRIEF.md)

---

## Overview

This document catalogs the twenty-three foundational product and technical architecture decisions for Veyro. Decisions `DEC-01` through `DEC-11` form the locked Phase 1 baseline. Decisions `DEC-12` (Vector Storage with `pgvector`) and `DEC-13` (Commercial LLM via provider-agnostic adapter) have their architectural directions approved, with concrete hosting/performance validations and specific provider contractual evaluations explicitly deferred to implementation. Decisions `DEC-14` through `DEC-19` reflect the approved conceptual hierarchy (`User → Account → Workspaces → Projects → Tasks`), Personal AI daily message quotas, Account Workspace subscriptions, 7-day grace period and downgrade lifecycles, and confirmed Project/Task write capabilities for the AI Assistant in Project Mode. `DEC-20` records Cross-Account Project Transfer as deferred post-MVP. `DEC-21` records exact commercial pricing and payment gateway selection as deferred to technical implementation. `DEC-22` and `DEC-23` document the approved rules for the Personal AI subscription payment failure and grace period lifecycle, and AI message consumption rules for proposals and confirmations.

---

## Decision Status Summary

| ID | Topic | Status | Approved Option & Summary |
| :--- | :--- | :---: | :--- |
| **DEC-01** | Official Product Branding | `APPROVED` | **Veyro** as sole product and brand name. |
| **DEC-02** | Multi-Tenancy Architecture | `APPROVED` | **Shared Database + Shared Schema** with tenant discriminator (`organizationId`/`workspaceId`). |
| **DEC-03** | Authentication & Token Security | `APPROVED` | **NestJS-Native JWT + HTTP-Only Cookies + Hashed Refresh Tokens**. |
| **DEC-04** | Invitation Delivery Channel | `APPROVED` | **Copyable Invitation Link with Optional Pluggable Email Adapter**. |
| **DEC-05** | Project Visibility Default | `APPROVED` | **Private by Default** (Assigned members only; Owner/Admin oversight). |
| **DEC-06** | Data Deletion & Lifecycle Policy | `APPROVED` | **Hybrid Policy** (Archive / Soft Delete / Cascading Hard Delete). |
| **DEC-07** | Project Creation Permissions | `APPROVED` | **Owners and Admins Only** in MVP. |
| **DEC-08** | Workspace Onboarding Lifecycle | `APPROVED` | **Decoupled Onboarding** (Signup does not auto-create workspace). |
| **DEC-09** | Invitation Acceptance Email Matching | `APPROVED` | **Strict Target Email Lock** (Authenticated user email must match invite). |
| **DEC-10** | Task Reopening Permissions & Preconditions | `APPROVED` | **Author/Admin Only + Mandatory Reason Comment** (Appended to comments & audit). |
| **DEC-11** | Soft-Deleted Task Retention Window | `APPROVED` | **30-Day Recovery Window** + scheduled purge (Transaction-level advisory lock protected). |
| **DEC-12** | AI Assistant Vector Storage & Retrieval Strategy | `APPROVED (Directional)` | **PostgreSQL + `pgvector`** (Subject to hosting platform support verification & retrieval performance benchmarking). |
| **DEC-13** | External LLM Provider Integration & Data Privacy | `APPROVED (Directional)` | **Commercial LLM API via Provider-Agnostic Adapter** (No model training; provider selection deferred; contractual retention/DPA review required before selection). |
| **DEC-14** | Product Conceptual Hierarchy & Ownership Boundary | `APPROVED` | **`User → Account → Workspaces → Projects → Tasks`** (Account owns billing & workspaces; Workspace is collaboration boundary; User is global identity). |
| **DEC-15** | Personal AI Subscription Tiers & Daily Quotas | `APPROVED` | **Daily quotas per User** (Free: 3, Pro: 15, Enterprise: 25, Epic: 50 msgs/day; reset 00:00 UTC). Independent of Workspaces; failures do not consume quota. |
| **DEC-16** | Account Workspace Subscriptions & Capacity Lifecycle | `APPROVED` | **Account-level limits** (Free: 1 WS / 3 Projects; Pro: 3 WS / 7 Projects; Enterprise: 10 WS / 15 Projects; Epic: Unl WS / 25 Projects across account). 7-day grace period; Free-plan downgrade holds all projects temporarily Read-only until Owner explicitly selects up to 3 editable projects (no implicit auto-selection); zero data deletion; archived projects remain archived; partial selections respected; manual reactivation on upgrade. Monthly billing; prices TBD. |
| **DEC-17** | AI Assistant Confirmed Write Scope in Project Mode | `APPROVED` | **Confirmed writes for Project & Task only** (Project create/update; Task create/update). Strictly prohibits deletions, archival, comments, and permissions. |
| **DEC-18** | AI Mutation Proposal & User Confirmation Flow | `APPROVED` | **Structured proposal UI + explicit confirmation + backend permission revalidation + atomic transaction execution**. |
| **DEC-19** | Workspace-Scoped Invitations & Isolation Boundary | `APPROVED` | **Invitations issued for specific Workspace**; acceptance grants access strictly to that Workspace. |
| **DEC-20** | Cross-Account Project Transfer Scope | `DEFERRED POST-MVP` | **Moving projects between distinct billing Accounts is deferred** to post-MVP. |
| **DEC-21** | Commercial Pricing & Payment Gateway Selection | `TBD / DEFERRED` | **Exact monetary pricing and payment provider integration choices deferred** to technical implementation. |
| **DEC-22** | Personal AI Subscription Lifecycle & Grace Period | `APPROVED` | **Paid AI subscriptions renew monthly**; failure enters 7-day grace in `Past Due` with full daily quota; unpaid falls back to Free (3 msgs/day) without deleting user data; manual cancellation active until cycle end; trusted webhook activation; decoupled from Account limits. |
| **DEC-23** | AI Message Consumption for Proposals & Confirmation | `APPROVED` | **Generating response or proposal consumes 1 message** (even if rejected); **confirming execution consumes 0 additional messages**; failures do not consume quota; internal retries never double-charge; backend revalidation and atomicity enforced. |

---

## Detailed Approved Decisions

### DEC-01: Official Product Branding & Naming
- **Status:** `APPROVED`
- **Approved Direction:** **Veyro** is the sole product name and brand. All references to generic project codenames have been removed across all documents.

---

### DEC-02: Multi-Tenancy Strategy at Database Layer
- **Status:** `APPROVED`
- **Approved Direction:** **Shared Database, Shared Schema with `organizationId` Discriminator Column**.
- **Implementation Rules:** Compound indexing `(organizationId, id)` on all tenant entities. NestJS Prisma Client Extension enforces query-level tenant scoping automatically. Mismatched tenant lookups return `404 Not Found`.

---

### DEC-03: Authentication Architecture & Session Management
- **Status:** `APPROVED`
- **Approved Direction:** **NestJS-Native JWT with Secure HTTP-Only Cookies & Database-Hashed Refresh Tokens**.
- **Implementation Rules:** 15-minute access token in `veyro_access_token` cookie. 7-day refresh token in `veyro_refresh_token` cookie. Refresh tokens stored in DB as SHA-256 hashes with single-use rotation (RTR) and reuse-detection compromise handling. Multi-layer CSRF protection (`SameSite=Lax`, custom client header `X-Veyro-Client`, CORS origin whitelist).

---

### DEC-04: Organization Invitation Delivery Channel for MVP
- **Status:** `APPROVED` (Option A)
- **Approved Direction:** **Copyable Invitation Link with an Optional Email Adapter**.
- **Implementation Rules:** The API generates a cryptographic secret token and returns the full acceptance URL to the inviting Admin in the UI. Admins can directly copy and share the link via internal communication channels (Slack, WhatsApp, manual email). If SMTP/Resend credentials are provided in `.env`, the optional email adapter dispatches the invitation email; if not configured, the system relies on the copyable URL without blocking local development or automated testing. Raw tokens are never written to application logs.

---

### DEC-05: Project Visibility & Access Default
- **Status:** `APPROVED`
- **Approved Direction:** **Private by Default**.
- **Implementation Rules:** Organization Members access only projects where an explicit `ProjectMembership` row exists. Unassigned projects return `404 Not Found`. Organization Owners and Admins have administrative visibility across all projects in the organization.

---

### DEC-06: Data Deletion & Lifecycle Policy
- **Status:** `APPROVED`
- **Approved Direction:** **Hybrid Lifecycle Strategy**.
- **Implementation Rules:**
  - *Archival:* Projects and Organizations can be archived (read-only preservation, reversible).
  - *Soft Deletion:* Tasks can be soft-deleted (`deletedAt = NOW()`), hiding them from active views while preserving audit history.
  - *Permanent Deletion:* Cascade deletion reserved for permanent project/org deletion, stale invitations, and expired tokens.

---

### DEC-07: Project Creation Permissions
- **Status:** `APPROVED`
- **Approved Direction:** **Owners and Admins Only**. Standard Organization Members cannot create projects in the MVP.

---

### DEC-08: Workspace Onboarding Lifecycle
- **Status:** `APPROVED`
- **Approved Direction:** **Decoupled Onboarding Flow**.
- **Implementation Rules:** User registration creates an individual user identity only. A user without a workspace is routed to an Onboarding Hub with explicit options to **Create Workspace** (becomes Owner) or **Join Workspace** (via invitation token).

---

### DEC-09: Invitation Acceptance Email Matching Policy
- **Status:** `APPROVED` (Option A)
- **Approved Direction:** **Strict Target Email Lock**.
- **Implementation Rules:** Both invitation emails and account emails are normalized (`trim().toLowerCase()`). When an authenticated user submits an invitation acceptance request, the API strictly asserts that `req.user.email === invitation.email`. If a user is signed in under a different account, the system rejects acceptance with `403 Forbidden: This invitation was issued to {invitedEmail}. You are currently signed in as {currentEmail}. Please switch accounts to accept.` If the user has no account, the registration form is locked to the invitation's recipient email.

---

### DEC-10: Task Reopening Permissions & Preconditions
- **Status:** `APPROVED` (Option A)
- **Approved Direction:** **Task Author or Authorized Admin Only with Mandatory Reason Comment**.
- **Implementation Rules:** Reopening a completed task (`DONE → IN_PROGRESS`) or reinstating a cancelled task (`CANCELLED → TODO`) is restricted to the original Task Author, an Organization Admin, or the Organization Owner. The parent project must be `ACTIVE` (reopening in archived or deleted projects returns `400 Bad Request`). The payload must include a non-empty, trimmed `reason` string of at least 5 characters. The reason is automatically appended to the task comment thread and logged in the immutable `ActivityLog`.

---

### DEC-11: Soft-Deleted Task Data Retention Window
- **Status:** `APPROVED` (Option A)
- **Approved Direction:** **30-Day Recovery Window Followed by Automated Scheduled Purge**.
- **Implementation Rules:** Soft-deleted tasks (`deletedAt IS NOT NULL`) remain restorable by the Author or Admin for exactly 30 calendar days (`deletedAt >= NOW() - INTERVAL '30 days'`), provided the parent project is active. After 30 days, an in-process scheduled cleanup job (NestJS `@nestjs/schedule` daily cron; no external queues or Redis) queries eligible tasks and permanently deletes them and their child comments inside an atomic database transaction. To guarantee single-instance execution and avoid lock stranding across connection poolers (PgBouncer / Neon / Supabase transaction pooling on port 6543), the cron job executes within an explicit database transaction (`prisma.$transaction`) acquiring a transaction-level advisory lock (`SELECT pg_try_advisory_xact_lock(hashtext('veyro_daily_purge_lock'))`) over bounded batches (e.g., `LIMIT 500`). The lock automatically releases on `COMMIT` or `ROLLBACK`. The cleanup outcome is logged to `ActivityLog` (`TASK_PURGED`). Transient errors roll back cleanly and retry on the next execution cycle.

---

### DEC-12: AI Assistant Vector Storage & Retrieval Strategy
- **Status:** `APPROVED (Directional)`
- **Approved Direction:** **PostgreSQL + `pgvector`** (Option A).
- **Context:** The product requirement for a dual-mode AI Assistant (Knowledge Mode strictly read-only + Workspace Project Assistant with confirmed writes; see DEC-17) is approved. Vector embeddings and similarity retrieval will be hosted within the shared PostgreSQL database using the `pgvector` extension, maintaining the modular monolith architecture without introducing external vector database services.
- **Implementation Validation Gates (Preconditions for Implementation):**
  1. *Hosting Platform Support Verification:* Prior to implementation, engineering must verify `pgvector` extension availability, version support, and resource constraints on the selected managed hosting provider (Neon or Supabase).
  2. *Retrieval Performance Benchmarking:* Retrieval performance, index build/maintenance overhead (HNSW vs. IVFFlat), and memory impact under expected multi-tenant volume must be benchmarked and validated prior to production rollout. *(Status: NOT RUN — scheduled for implementation phase).*
- **Multi-Tenant Schema Invariants:**
  - *Shared Public Documentation Index:* Curated static documentation chunks are stored in a dedicated unpartitioned table `knowledge_base_embeddings` (or designated with `organizationId IS NULL`).
  - *Private Workspace Embeddings:* Workspace task and project chunk embeddings are stored in `workspace_embeddings` declaring `organizationId UUID NOT NULL REFERENCES organizations(id)` with a compound index `(organizationId, id)`.
  - Workspace similarity queries execute cosine distance search strictly filtered by `WHERE organizationId = :activeOrgId` with pre-LLM project authorization.

---

### DEC-13: External LLM Provider Integration & Data Privacy Policy
- **Status:** `APPROVED (Directional)`
- **Approved Direction:** **Commercial LLM API accessed via a Provider-Agnostic Adapter** (Option A).
- **Context:** The Veyro AI Assistant will synthesize contextual responses via an external commercial LLM API. To avoid vendor lock-in and uphold rigorous multi-tenant data governance, integration is decoupled through an injectable NestJS adapter interface (`LlmProviderService`).
- **Implementation & Privacy Validation Gates:**
  1. *Deferred Provider Selection:* The concrete commercial LLM provider (e.g., OpenAI, Anthropic, or alternative) is **explicitly deferred** until the AI Assistant implementation phase.
  2. *Model Training Prohibition Invariant:* Customer workspace data must strictly **NOT** be used for model training or fine-tuning under any circumstances.
  3. *Contractual Privacy Review Before Selection:* Prior to selecting and onboarding any LLM provider, engineering must formally review the provider's actual contractual retention periods, logging practices, deletion mechanisms, subprocessors, and Data Processing Addendum (DPA) terms. The team must **not assume Zero Data Retention (ZDR)** without verified contractual evidence.
  4. *Data Egress Quarantine:* System credentials, session tokens, passwords, database URLs, cross-tenant data, and data from unassigned projects must never be transmitted in prompts. Context must be quarantined inside `<untrusted_context>` tags.

---

### DEC-14: Product Conceptual Hierarchy & Ownership Boundary
- **Status:** `APPROVED`
- **Approved Direction:** **`User → Account → Workspaces → Projects → Tasks`**.
- **Context & Implementation Rules:**
  - `User`: Global authenticated identity with credentials and personal AI subscription. Can belong to multiple Accounts and Workspaces.
  - `Account`: Top-level commercial and legal entity. Owns the Account Workspace subscription, billing details, and 1..N Workspaces. Managed by an `Account Owner`.
  - `Workspace`: Collaborative environment and primary multi-tenant isolation unit containing Projects, Tasks, and team memberships (`Workspace Admin`, `Workspace Member`).
  - `Projects` & `Tasks`: Collaborative work units contained within a specific Workspace.
  - Conceptual boundary separation: Multi-tenant data queries isolate at the Workspace boundary; subscription billing capacity aggregates across all Workspaces owned by the Account.
  - Note: Concrete database schema adjustments and foreign key naming (e.g., transition from legacy `organizationId` to explicit `account_id` / `workspace_id`) are explicitly deferred to Phase 2 ERD and Prisma data modeling.

---

### DEC-15: Personal AI Subscription Tiers & Daily Message Quotas
- **Status:** `APPROVED`
- **Approved Direction:** **User-Level Daily Message Quotas with Strict 00:00 UTC Reset**.
- **Implementation Rules:**
  - Tiers & Daily Quotas:
    - `Free`: 3 messages/day
    - `Pro`: 15 messages/day
    - `Enterprise`: 25 messages/day
    - `Epic`: 50 messages/day
  - Independence: Personal AI subscriptions attach to the individual `User` identity, not to any Workspace or Account. A user retains their quota whether they belong to zero, one, or multiple Workspaces.
  - Reset Cadence: Fixed daily reset strictly at **`00:00 UTC`**. Unused daily quota does not roll over.
  - Consumption Accounting: A successful AI query response consumes exactly 1 message. Technical upstream failures (LLM provider timeouts, 504 errors) do **not** consume quota. Internal retry attempts must never double-charge.
  - Exhaustion Behavior: When quota reaches 0, subsequent requests are blocked with an informative message displaying the reset time (`00:00 UTC`) and an upgrade link.

---

### DEC-16: Account Workspace Subscriptions & Capacity Lifecycle
- **Status:** `APPROVED`
- **Approved Direction:** **Account-Level Workspace and Aggregate Project Limits with 7-Day Grace Period & Downgrade Safety Policy**.
- **Implementation Rules:**
  - Tier Limits:
    - `Free`: Max 1 Workspace, Max 3 Projects across the Account.
    - `Pro`: Max 3 Workspaces, Max 7 Projects across the Account.
    - `Enterprise`: Max 10 Workspaces, Max 15 Projects across the Account.
    - `Epic`: Unlimited Workspaces, Max 25 Projects across the Account.
  - Aggregate Project Counting: Project capacity is enforced across all Workspaces owned by the Account in aggregate (e.g., Pro allows 7 projects total across up to 3 workspaces). Archived projects count toward the limit; soft-deleted projects do not. Empty workspaces consume zero project slots. Moving a project between workspaces within the same account does not alter the aggregate project count.
  - Billing Cadence & Pricing: Billed monthly in MVP (annual deferred). Exact monetary pricing is `TBD` and deferred until commercial checkout launch.
  - Payment Failure & 7-Day Grace Period: Failed renewal payment moves Account to `Past Due` for 7 calendar days. Full plan access continues during grace, but creation beyond existing plan capacity is blocked.
  - Downgrade to Free Invariants (After Grace Period Expiry):
    1. The Account is restricted to Free limits (max 1 Workspace, max 3 Projects across the Account).
    2. The Account Owner must explicitly select up to 3 Projects to remain editable under Free limits.
    3. The system shall **never** automatically select the three most recently updated projects or select any projects via an implicit rule.
    4. Until the Owner completes this selection, **all Projects in the Account remain temporarily Read-only**.
    5. After selection, only the selected eligible projects may become editable; all unselected projects remain Read-only.
    6. `Read-only` is an access tier constraint due to subscription limits, distinct from `Archived` (voluntary freeze) or `Soft-deleted` (trash).
    7. If the Owner selects an Archived project, it remains Archived (selecting an archived project does not automatically unarchive it). Soft-deleted projects remain soft-deleted.
    8. If the Owner selects fewer than 3 projects, only the selected projects become editable (no auto-fill for unused slots).
    9. **Zero Automated Data Deletion:** Customer project and task data is never deleted due to a plan downgrade.
  - Upgrade Reactivation: Upgrades activate strictly via trusted billing webhook confirmation. Downgraded `Read-only` projects do **not** automatically become editable upon upgrade; the Account Owner must explicitly select and reactivate desired projects within the new capacity limit.

---

### DEC-17: Veyro AI Assistant Confirmed Write Scope in Project Mode
- **Status:** `APPROVED`
- **Approved Direction:** **Restricted, User-Confirmed Write Capabilities for Projects and Tasks in Project Mode**.
- **Context:** Replaces the previous blanket "strictly read-only" MVP restriction for Project Mode. Knowledge Mode remains strictly read-only over public documentation. Project Mode provides dual read/write functionality with strict safety boundaries.
- **Implementation Rules:**
  - Permitted Project Mutations: Create Project (within authorized Workspace, asserting Account project limit); Update Project `Name` and `Description`.
  - Permitted Task Mutations: Create Task within authorized Project; Update Task `Title`, `Description`, `Status`, `Assignee`, `Due Date`, and `Priority`.
  - Explicitly Prohibited AI Actions: The AI Assistant must **never** delete Projects or Tasks, archive or unarchive Projects, create/edit/delete Comments, or modify memberships, roles, or billing/subscription settings.
  - All mutations require structured proposals and explicit user confirmation (see DEC-18).

---

### DEC-18: AI Mutation Proposal & User Confirmation Flow
- **Status:** `APPROVED`
- **Approved Direction:** **Structured Change Proposal + Explicit User Confirmation + Backend Revalidation + Atomic Execution**.
- **Implementation Rules:**
  - Structured Change Proposal: When the user requests an action, the AI synthesizes a structured proposal rendered in the UI with a diff/preview.
  - Explicit Confirmation: The user must explicitly inspect and confirm the proposal via UI action before any database mutation occurs.
  - Backend Execution Revalidation: The UI confirmation is not a security boundary. The backend strictly re-verifies the user's active session, Workspace/Project permissions, resource active status, Account subscription project limit, and task state machine transition rules.
  - Atomic All-or-Nothing Execution: Multi-entity mutations execute within a single database transaction (`prisma.$transaction`). Any validation or execution failure triggers a complete rollback with zero partial state persisted.

---

### DEC-19: Workspace-Scoped Invitations & Isolation Boundary
- **Status:** `APPROVED`
- **Approved Direction:** **Invitations Scoped Strictly to a Single Workspace**.
- **Implementation Rules:** Invitations are created by a Workspace Admin or Account Owner targeting a specific `workspaceId`. Accepting an invitation grants `Workspace Member` (or Admin) access solely to that designated Workspace. It grants zero access to other Workspaces owned by the same Account. Tenant authorization checks assert the specific `workspaceId`.

---

### DEC-20: Cross-Account Project Transfer Scope
- **Status:** `DEFERRED POST-MVP`
- **Deferred Direction:** **Moving Projects Between Distinct Billing Accounts is Deferred to Post-MVP**.
- **Rationale:** Transferring a Project and its historical tasks, comments, activity logs, and attachments between two distinct billing accounts introduces complex billing entitlement, audit trail ownership, and access reassignment concerns. Moving projects between Workspaces *within the same Account* is supported; cross-account transfer is deferred.

---

### DEC-21: Commercial Pricing & Payment Gateway Selection
- **Status:** `TBD / DEFERRED`
- **Deferred Direction:** **Monetary Pricing Tiers and Payment Gateway Adapter Selection Deferred to Implementation Phase**.
- **Rationale:** The tier structures, feature limits, daily message quotas, and subscription lifecycle mechanics are fully approved (`DEC-15`, `DEC-16`). Exact currency prices (USD/EUR) and the selection of the payment processing provider (Stripe, Lemon Squeezy, Paddle) will be specified during technical implementation via a payment adapter interface without impacting the Phase 1 business baseline.

---

### DEC-22: Personal AI Subscription Payment Failure, Grace Period, and Cancellation Lifecycle
- **Status:** `APPROVED`
- **Approved Direction:** **Independent User-Scoped Lifecycle with 7-Day Grace Period, Safe Free Fallback, and Zero Data Loss**.
- **Context:** The Personal AI Subscription belongs to each individual `User` identity and operates completely independently of the Account Workspace Subscription.
- **Implementation Rules:**
  1. *Monthly Renewal Cadence:* Paid AI subscriptions renew on a monthly cadence in the MVP. (Exact monetary prices and payment processor are deferred per DEC-21).
  2. *Payment Failure & Grace Period:* When a renewal payment fails, the AI subscription enters `Past Due` status, triggering a mandatory 7-day grace period. During this period, the User retains their current paid AI tier and its full daily quota (e.g., Pro: 15 messages/day).
  3. *Fallback to Free Tier:* If payment remains unresolved after 7 days, the User's AI subscription falls back to `Free` tier (3 successful messages/day).
  4. *Zero Data Deletion Invariant:* Downgrading an AI subscription must never delete the User's account identity, workspace memberships, project data, or conversation records.
  5. *Manual Cancellation:* Manual cancellation does not immediately revoke paid benefits. Benefits remain active until the end of the current billing cycle, after which the subscription transitions to Free unless renewed.
  6. *Server-Side Activation:* Subscriptions become Active strictly upon verified server-side payment confirmation (e.g., trusted billing webhook); frontend redirects alone are insufficient.
  7. *Decoupled Boundaries:* The Personal AI subscription lifecycle does not alter Account Workspace or Project capacity limits. Conversely, Account plan downgrades or grace periods do not reduce members' personal AI quotas.

---

### DEC-23: AI Message Consumption for Proposals and Confirmation
- **Status:** `APPROVED`
- **Approved Direction:** **Single Quota Deduction upon Generation; Zero Deduction upon Confirmation or Execution**.
- **Context:** Clarifies the exact accounting boundary between generating AI proposals and executing confirmed changes.
- **Implementation Rules:**
  1. *Proposal Generation Consumes 1 Message:* A successfully generated AI response or structured change proposal consumes exactly 1 AI message from the User's daily quota.
  2. *Rejection Retains Consumption:* This message remains consumed even if the User reviews and rejects/cancels the proposal, as AI compute and retrieval were successfully executed.
  3. *Execution Consumes 0 Additional Messages:* Clicking "Confirm" in the UI to execute an already-generated proposal does **not** consume another AI message (0 additional messages deducted), because execution requires no new LLM generation. Ordinary UI interactions and executing approved proposals never count as new AI messages.
  4. *Technical Failure Non-Consumption:* Upstream technical failures (LLM provider timeouts, 504 gateway errors) that prevent producing a usable response or proposal do **not** consume daily quota.
  5. *Retry Protection:* Internal system retries for the same request must never double-charge or deduct multiple messages.
  6. *Backend Validation & Atomicity:* Executing confirmed proposals re-verifies all user permissions, project status, and account limits server-side, and applies all related mutations inside an atomic database transaction (`prisma.$transaction`) with all-or-nothing rollback.

---

## Approval Sign-Off Checklist

Baseline product and architectural decisions:

- [x] **DEC-01:** Product Branding (Veyro) — *APPROVED*
- [x] **DEC-02:** Multi-Tenancy Architecture (Shared DB + Shared Schema with tenant discriminator) — *APPROVED*
- [x] **DEC-03:** Authentication & Session Security (NestJS JWT + HTTP-only cookies + Hashed Refresh Tokens) — *APPROVED*
- [x] **DEC-04:** Invitation Delivery Channel (Copyable Link + Optional Email Adapter) — *APPROVED*
- [x] **DEC-05:** Project Visibility Default (Private by Default + Owner/Admin Oversight) — *APPROVED*
- [x] **DEC-06:** Data Deletion & Lifecycle Policy (Hybrid Strategy) — *APPROVED*
- [x] **DEC-07:** Project Creation Permissions (Owners and Admins Only) — *APPROVED*
- [x] **DEC-08:** Workspace Onboarding Lifecycle (Decoupled Onboarding) — *APPROVED*
- [x] **DEC-09:** Invitation Email Matching (Strict Target Email Lock) — *APPROVED*
- [x] **DEC-10:** Task Reopening Permissions & Reason Comment (Author/Admin Only + Mandatory Reason) — *APPROVED*
- [x] **DEC-11:** Soft-Deleted Task Retention Window (30-Day Recovery Window + Scheduled Purge) — *APPROVED*
- [x] **DEC-12:** AI Assistant Vector Storage & Retrieval Strategy — *APPROVED (Directional: PostgreSQL + `pgvector`; platform verification & retrieval benchmarking required before implementation)*
- [x] **DEC-13:** External LLM Provider Integration & Data Privacy Policy — *APPROVED (Directional: Commercial LLM via provider-agnostic adapter; provider selection deferred; contractual retention/DPA review required before selection)*
- [x] **DEC-14:** Product Conceptual Hierarchy & Ownership Boundary (`User → Account → Workspaces → Projects → Tasks`) — *APPROVED*
- [x] **DEC-15:** Personal AI Subscription Tiers & Daily Quotas (Free: 3, Pro: 15, Enterprise: 25, Epic: 50 msgs/day; reset 00:00 UTC) — *APPROVED*
- [x] **DEC-16:** Account Workspace Subscriptions & Capacity Lifecycle (Account limits, 7-day grace period, downgrade safety, manual reactivation) — *APPROVED*
- [x] **DEC-17:** Veyro AI Assistant Confirmed Write Scope in Project Mode (Project/Task create & update; delete/archive/comment prohibited) — *APPROVED*
- [x] **DEC-18:** AI Mutation Proposal & User Confirmation Flow (Proposal UI + explicit confirmation + backend revalidation + atomic transaction) — *APPROVED*
- [x] **DEC-19:** Workspace-Scoped Invitations & Isolation Boundary (Workspace-level invite scoping and access isolation) — *APPROVED*
- [ ] **DEC-20:** Cross-Account Project Transfer Scope — *DEFERRED POST-MVP*
- [ ] **DEC-21:** Commercial Pricing & Payment Gateway Selection — *TBD / DEFERRED TO TECHNICAL IMPLEMENTATION*
- [x] **DEC-22:** Personal AI Subscription Payment Failure, Grace Period, and Cancellation Lifecycle — *APPROVED*
- [x] **DEC-23:** AI Message Consumption for Proposals and Confirmation — *APPROVED*

---

## Final Phase 1 Status

**PHASE 1 SPECIFICATION APPROVED — READY FOR PHASE 2 (Approved on October 11, 2026)**

All twenty-three foundational product, technical architecture, subscription, and AI governance directions (`DEC-01` through `DEC-23`) have been reviewed, aligned, and formally reconciled across all Phase 1 documentation.

*(Note: Phase 1 establishes the documentation, business requirements, and architectural baseline. Concrete database modeling (ERD), Prisma schema changes, API contract design, runtime load benchmarks, hosting extension validations, payment gateway integrations, and post-MVP deferred items will be executed in subsequent phases upon human sign-off).*
