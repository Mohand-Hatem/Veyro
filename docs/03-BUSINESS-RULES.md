# 03. Business Rules & Domain Invariants: Veyro

**Document Version:** 1.5.2 (Final Downgrade Selection Clarification)  
**Phase:** Phase 1 — Product Discovery & MVP Definition  
**Status:** PHASE 1 APPROVED — READY FOR PHASE 2 (Approved on October 11, 2026)  
**Parent Document:** [`01-PROJECT-BRIEF.md`](./01-PROJECT-BRIEF.md)

---

## 1. Account, Workspace & Membership Rules

### BR-ACC-01: Multi-Tenancy Hierarchy & Boundaries
1. Veyro enforces the conceptual hierarchy: **`User → Account → Workspaces → Projects → Tasks`**.
2. The **Account** is the ownership, billing, and subscription boundary. An Account owns one or more Workspaces and holds the Account Workspace Subscription plan.
3. The **Workspace** is the collaborative working area. Projects, tasks, and task comments belong strictly to a Workspace.
4. Cross-workspace and cross-account data queries, relational joins, or foreign key associations are strictly prohibited at both the database schema and application layers. (Data-model schema optimization is scoped by tenant identifiers; concrete schema changes deferred to Phase 2).

### BR-ACC-02: Account Creation & Ownership
1. Any authenticated user can create an Account, automatically becoming its **Account Owner** (`role = OWNER`).
2. An Account must have **exactly one Owner** at all times in the MVP (co-ownership is deferred).
3. The Account Owner manages billing, subscriptions, payment methods, and Account-level settings.
4. An Account Owner cannot delete their user account or leave the Account if they are the sole owner; ownership must be transferred first.

### BR-WS-01: Workspace Creation & Isolation
1. Workspaces belong to an Account.
2. **Workspace Creation Permissions:** Workspace creation is restricted to the Account Owner and authorized Workspace Admins. Ordinary Workspace Members cannot create Workspaces by default.
3. Workspace slugs must be URL-safe, globally unique, lowercase alphanumeric with hyphens, and between 3 and 50 characters in length.
4. **Workspace Isolation:** Workspace Members only access projects they are authorized to access in their specific Workspace and do not gain visibility into other Workspaces merely because they belong to the same Account.

### BR-WS-02: Workspace-Scoped Member Invitations & Lifecycle
1. **Scope Restriction:** Invitations target a specific Workspace (`workspaceId`) with a designated Workspace role (`ADMIN` or `MEMBER`). Users cannot be invited as Account Owner via workspace invites. An invitation to one Workspace never grants access to other Workspaces within the Account.
2. **Delivery Mechanism:** System generates a copyable invitation URL containing a raw secret token. An optional Email Adapter dispatches emails if configured in the environment; no third-party email provider is mandatory in MVP.
3. **Secret Token Security:** Raw invitation tokens must possess at least 256-bit cryptographic entropy. The database persists only the SHA-256 hash (`hashedToken`). Raw tokens are exposed only once to the inviting Admin in the UI copyable link and are strictly prohibited from appearing in application logs.
4. **Expiration & Single-Use:** Invitations expire exactly **7 days** after generation (`expiresAt = createdAt + 7 days`). Tokens are strictly **single-use**; upon acceptance, status transitions to `ACCEPTED` and the token is permanently invalidated.
5. **Revocation:** Workspace Admins and Account Owners can revoke pending invitations at any time prior to acceptance (`status = REVOKED`).
6. **Email Normalization & Strict Matching:** All invitation emails and user account emails are normalized (whitespace-trimmed and converted to lowercase). Acceptance requires that the authenticated user's normalized account email strictly matches the invitation recipient email. Mismatches return `403 Forbidden: This invitation was issued to {invitedEmail}. You are currently signed in as {currentEmail}. Please switch accounts to accept.`
7. **Atomic Single-Use Acceptance:** Executed via an atomic conditional SQL update inside an explicit database transaction to prevent concurrent race conditions.

---

## 2. Role & Permission Matrix (RBAC)

The following matrix defines the authoritative permissions across Account, Workspace, Project, and AI assets.

| Action / Capability | Account Owner | Workspace Admin | Workspace Member (Assigned to Project) | Workspace Member (Not Assigned) |
| :--- | :---: | :---: | :---: | :---: |
| **Manage Account Billing & Subscriptions** | ✅ | ❌ | ❌ | ❌ |
| **Select Editable Projects on Plan Downgrade** | ✅ | ❌ | ❌ | ❌ |
| **Reactivate Projects on Plan Upgrade** | ✅ | ❌ | ❌ | ❌ |
| **Create Workspace within Account** | ✅ | ✅ (Authorized) | ❌ | ❌ |
| **Manage Workspace Settings (Name, Slug)** | ✅ | ✅ | ❌ | ❌ |
| **Archive / Unarchive Workspace** | ✅ | ✅ | ❌ | ❌ |
| **Permanently Delete Workspace / Account** | ✅ (Password confirmation) | ❌ | ❌ | ❌ |
| **Transfer Account Ownership** | ✅ | ❌ | ❌ | ❌ |
| **Invite Workspace Members** | ✅ | ✅ | ❌ | ❌ |
| **Revoke / Resend Invitations** | ✅ | ✅ | ❌ | ❌ |
| **Remove Workspace Members** | ✅ | ✅ (Non-Owners) | ❌ | ❌ |
| **Change Member Roles** | ✅ | ✅ (Promote to Admin / Demote to Member) | ❌ | ❌ |
| **Create Project within Workspace** | ✅ | ✅ | ❌ | ❌ |
| **Archive / Unarchive Project** | ✅ | ✅ | ❌ | ❌ |
| **Permanently Delete Project** | ✅ | ✅ | ❌ | ❌ |
| **Assign / Remove Project Members** | ✅ | ✅ | ❌ | ❌ |
| **View Project Board & Task List** | ✅ (Admin Oversight) | ✅ (Admin Oversight) | ✅ | ❌ *(Returns 404)* |
| **Create Task within Project** | ✅ | ✅ | ✅ | ❌ |
| **Edit Task Details / Due Date** | ✅ | ✅ | ✅ | ❌ |
| **Transition Task Status (Standard)** | ✅ | ✅ | ✅ | ❌ |
| **Reopen / Reinstate Task (Done/Cancelled)** | ✅ | ✅ | Author Only *(Mandatory Reason)* | ❌ |
| **Soft-Delete Task** | ✅ | ✅ | Author Only | ❌ |
| **Restore Soft-Deleted Task (<30d)** | ✅ | ✅ | Author Only *(Subject to Plan Limit)* | ❌ |
| **Post Comment on Task** | ✅ | ✅ | ✅ | ❌ |
| **Edit / Delete Comment** | Workspace Admins can delete | Workspace Admins can delete | Author Only | ❌ |
| **View Activity Log** | ✅ | ✅ | Scoped to Assigned Projects | ❌ |
| **Trigger Confirmed AI Project/Task Mutation** | ✅ | ✅ | ✅ (Within permitted Task scope) | ❌ |

---

## 3. Project & Task Lifecycle Rules

### BR-PRJ-01: Project Privacy & Visibility
1. All projects are **private by default**.
2. Standard Organization Members can only see and access projects where an active `ProjectMembership` record exists linking them to the project.
3. Organization Owners and Admins possess administrative oversight and can view, access, and manage all projects in the organization.
4. Any attempt by an unassigned Member to query or access a project returns `404 Not Found`.

### BR-PRJ-02: Project Lifecycle States
Projects have two lifecycle states:
1. `ACTIVE`: Default state. Open for task creation, editing, and active workflows.
2. `ARCHIVED`: Read-only state. Tasks cannot be created, modified, transitioned, or reopened within an archived project. Historical task data and comments remain readable.
3. Only Org Admins and Owners can archive or unarchive a project.

### BR-TSK-01: Task State Machine & Transitions
Tasks support five distinct statuses:
- `TODO`: Pending work not yet begun.
- `IN_PROGRESS`: Actively underway by the assignee.
- `IN_REVIEW`: Work completed and submitted for verification.
- `DONE`: Successfully verified and complete.
- `CANCELLED`: Abandoned, redundant, or obsolete.

#### Authoritative Transition Rules
```
TODO         ──> IN_PROGRESS, CANCELLED
IN_PROGRESS  ──> IN_REVIEW, TODO, CANCELLED
IN_REVIEW    ──> DONE, IN_PROGRESS, CANCELLED
DONE         ──> IN_PROGRESS (Reopened)
CANCELLED    ──> TODO (Reinstated)
```
- Direct jumps skipping review (e.g., `TODO → DONE`) are disallowed to maintain delivery rigor.

#### Reopening & Reinstatement Invariants
1. **Permitted Roles:** Strictly the original Task Author, Organization Admin, or Organization Owner. Standard project members who are not the author cannot reopen a completed task.
2. **Project Invariant:** The parent project must be `ACTIVE`. If the parent project is `ARCHIVED` or soft-deleted, the API rejects reopening with `400 Bad Request: Cannot reopen tasks in an archived or deleted project.`
3. **Mandatory Reason:** Reopening (`DONE → IN_PROGRESS`) or reinstating (`CANCELLED → TODO`) requires a non-empty, trimmed `reason` string of at least 5 characters in the payload.
4. **Audit Logging:** The reason is automatically appended to the task comment thread with author attribution and recorded in the immutable `ActivityLog` (`TASK_REOPENED` / `TASK_REINSTATED`).

### BR-TSK-02: Task Priorities
Tasks have four defined priority levels:
- `LOW`
- `MEDIUM` (Default)
- `HIGH`
- `URGENT`

### BR-TSK-03: Assignment Invariants
1. A task can have at most **one primary assignee** in the MVP.
2. The `assigneeId` must belong to a user who is an active member of the organization **AND** explicitly assigned to the parent project.
3. Assigning a task to an organization member who is not a member of the project is rejected with `400 Bad Request: Assignee must be a member of the containing project`.
4. If an assignee is removed from a project or organization, all their assigned tasks have their `assigneeId` set to `null` (Unassigned) with an audit record logged.

### BR-TSK-04: Due Dates & Timezone Invariant
1. Due dates are stored in UTC format (`ISO-8601` timestamp).
2. Setting a past due date is permitted (to accommodate retrospective task entry).
3. The UI will render an `OVERDUE` indicator if `dueDate < CURRENT_TIMESTAMP` and `status NOT IN ('DONE', 'CANCELLED')`.

---

## 4. Multi-Tenant Data Isolation Rules

### BR-ISO-01: Multi-Layer Defense-in-Depth Tenant Isolation
Veyro rejects reliance on any single application layer for tenant security. While NestJS Prisma Client Extensions provide an ergonomic developer guardrail, true multi-tenant safety requires an end-to-end **Defense-in-Depth** model across six distinct layers:

1. **Layer 1 — HTTP Guard & Context Resolution:** The `TenantGuard` inspects the request (`x-organization-id` header or route parameter), verifies that the authenticated user possesses an active membership in that organization, and attaches `organizationId` to the execution context. Mismatched or forged IDs are rejected with `403 Forbidden`.
2. **Layer 2 — Application Service Layer:** Every domain service and repository method explicitly accepts and requires `organizationId` as a mandatory parameter in all query arguments (`where: { organizationId, ... }`).
3. **Layer 3 — Prisma Client Extension Middleware:** A global Prisma Client extension (`$extends({ query: ... })`) intercepts all Prisma queries, asserting that `organizationId` is present on all tenant-scoped model operations (read, create, update, delete). If a developer inadvertently omits the tenant filter, the extension automatically injects it or halts execution.
4. **Layer 4 — Database Query Optimization & SQL Restrictions:** Every tenant-scoped table declares `organizationId UUID NOT NULL REFERENCES organizations(id)` and includes a compound index on `(organizationId, id)`. *(Note: Compound indexes are storage engine access path optimizations to accelerate tenant-scoped queries; they do not enforce authorization or security boundaries).* Raw SQL queries (`$queryRaw`) that bypass tenant scoping are strictly prohibited in application code and flagged in static analysis.
5. **Layer 5 — Future PostgreSQL Row-Level Security (RLS) Path:** The database schema is architected to support native PostgreSQL Row-Level Security (`ALTER TABLE tasks ENABLE ROW LEVEL SECURITY`) with session-bound tenant identifiers (`SET LOCAL app.current_org_id = :orgId`) as an infrastructure-level safety net for high-compliance deployments.
6. **Layer 6 — Automated Testing Requirements:** CI test suites must enforce automated integration tests specifically asserting cross-tenant IDOR rejection, unassigned project containment, relationship foreign key isolation, and raw query prohibition as verification requirements.

### BR-ISO-02: Anti-IDOR (Insecure Direct Object Reference) Protection
1. Endpoints that accept resource IDs (e.g., `PATCH /api/tasks/:id`) must never look up records solely by primary key.
2. Queries must evaluate: `WHERE id = :id AND organizationId = :activeOrgId`.
3. If an entity exists in the database under another workspace, the API must respond with **`404 Not Found`** (not `403 Forbidden`) to eliminate resource enumeration vectors across tenants.
4. Relational queries linking entities (e.g., assigning a task to a project) must verify that both parent and child belong to the identical `workspaceId`.

---

## 5. Deletion, Archival & Retention Policy

Veyro enforces a disciplined hybrid lifecycle policy across all domain entities, clearly distinguishing between Archival, Soft Deletion, and Permanent Deletion:

| Entity | Archival Policy | Soft Deletion Policy | Permanent Deletion Policy & Cascades | Interaction with Subscription Capacity |
| :--- | :--- | :--- | :--- | :--- |
| **Account** | Not applicable in MVP. | Not applicable in MVP. | Strictly restricted to Account Owner. Requires 2-step password confirmation. Cascades to all Workspaces, projects, tasks, comments, memberships, logs, and AI history. | Cancels active subscription; stops future billing renewals. |
| **Workspace** | Owner/Admin can set `status = ARCHIVED`. All projects become read-only. Data preserved. | Not applicable in MVP. | Strictly restricted to Owner. Cascades to child projects, tasks, comments, and workspace-linked AI history. | Empty workspaces consume 0 project slots. |
| **Project** | Admin/Owner can set `status = ARCHIVED`. Tasks become read-only. Full history preserved. | Admin/Owner can soft-delete (`deletedAt = NOW()`). Project is hidden from normal views. | Admin/Owner can trigger permanent deletion. Cascades deletion to child tasks, comments, and project AI records. | **Archived projects count** toward the Account Project limit.<br>**Soft-deleted projects do NOT count** toward the limit. |
| **Task** | Not applicable (use `CANCELLED` or `DONE`). | Author, Admin, or Owner can soft-delete (`deletedAt = NOW()`). Hidden from active boards. Retains comments and history. | **30-Day Purge:** Automatically purged after 30 days by scheduled cleanup. Cascades deletion to child comments and task AI records. | Does not affect Account project capacity. |
| **Comment** | Not applicable. | Marked as `deletedAt = NOW()`; content masked with `[Comment deleted by user]` to preserve conversation continuity. | Deleted permanently when parent task is permanently purged or deleted. | N/A |
| **Invitation** | Not applicable. | Tokens set to `status = REVOKED` or `EXPIRED`. | Stale expired invitations permanently purged periodically. | N/A |
| **Refresh Token** | Not applicable. | Marked `revokedAt = NOW()` upon logout or rotation. | Expired and revoked tokens permanently purged periodically. | N/A |
| **AI History & Embeddings** | Not applicable. | Ephemeral chat sessions cleared by user. | Cascades permanently upon deletion of parent task, project, or workspace. Daily cleanup purges orphan query logs >90 days. | N/A |

### BR-DEL-02: 30-Day Task Recovery & Capacity Invariant
1. **Recovery Window:** A soft-deleted task remains restorable for exactly **30 calendar days** (`deletedAt >= NOW() - INTERVAL '30 days'`).
2. **Restoration Rights & Preconditions:** The Task Author, Workspace Admin, or Account Owner can restore a soft-deleted task (`POST /api/tasks/:id/restore`). Restoration is permitted only if the parent project is currently `ACTIVE`. If the parent project is archived or deleted, restoration returns `409 Conflict`.
3. **Project Restoration Capacity Check:** Restoring a soft-deleted *Project* requires available project capacity under the Account's subscription plan. If restoring the project would cause total active and archived projects to exceed the Account's limit, the API blocks restoration with `409 Conflict: Project limit reached for your Account subscription plan. Free up capacity or upgrade to restore.`
4. **Scheduled Cleanup Execution & Concurrency Safety:**
   - Cleanup executes via an in-process scheduled job (NestJS `@nestjs/schedule` daily cron; no external Redis or message queue dependency in MVP).
   - **Transaction-Level Advisory Lock (`pg_try_advisory_xact_lock`):** Executes inside an explicit database transaction (`prisma.$transaction`) acquiring a transaction-level advisory lock (`SELECT pg_try_advisory_xact_lock(hashtext('veyro_daily_purge_lock'))`) over bounded batches (`LIMIT 500`). Releases automatically on `COMMIT` or `ROLLBACK`.

---

## 6. Subscription & Plan Invariants

### BR-SUB-01: Personal AI Subscription & Daily Message Quota Invariants
1. **Scope:** Belongs to the individual `User` identity and applies across all Accounts, Workspaces, and Projects the User is authorized to access.
2. **Workspace Independence:** Personal AI access (Knowledge Mode) does **not** require creating or joining any Workspace.
3. **Daily Entitlements:**
   - `Free`: 3 messages per day
   - `Pro`: 15 messages per day
   - `Enterprise`: 25 messages per day
   - `Epic`: 50 messages per day
4. **Reset Cadence:** Daily quota resets strictly at **`00:00 UTC`**. Unused daily quota does not roll over.
5. **Renewal & Billing Cadence:** Paid AI subscriptions renew on a monthly cadence in the MVP. Exact monetary prices are `TBD`.
6. **Payment Failure & 7-Day Grace Period:**
   - When a monthly renewal payment fails, the AI subscription transitions to **`Past Due`** and enters a mandatory **7-day grace period**.
   - During the grace period, the User retains their existing AI plan tier and full daily quota (e.g., Pro: 15 messages/day).
7. **Downgrade to Free Tier:**
   - If payment remains unsuccessful after the 7-day grace period, the User's AI subscription falls back to **`Free`** tier limits (3 successful messages per day).
   - **Zero Automatic Data Deletion:** Downgrading an AI subscription must never delete the User's account, project data, or conversation records.
8. **Manual Cancellation:** Manual cancellation does not immediately remove paid benefits. They remain active until the end of the already-paid billing period, after which the subscription transitions to Free unless a valid renewal or replacement applies.
9. **Payment Activation:** A subscription becomes Active strictly after trusted server-side payment confirmation (e.g., verified billing webhook). A frontend redirect alone is insufficient proof of payment.
10. **Decoupled Subscription Lifecycles:**
    - The Personal AI Subscription lifecycle must not change the Account's Workspace or Project limits.
    - Account subscription changes must not change the User's personal AI quota.
11. **Message Consumption Accounting & Proposal Rules:**
    - A successfully generated AI response or change proposal consumes exactly **1 message** from the User's daily quota.
    - This message is consumed even if the User reviews and rejects the proposal (as AI computation occurred).
    - Clicking Confirm to execute the same already-generated proposal does **not** consume another AI message (0 additional messages deducted), because it requires no new AI generation.
    - Ordinary UI interactions and the execution of an already-generated proposal do not count as a new AI message.
    - Upstream technical failures (e.g., LLM gateway timeouts, 504 errors) preventing a usable response or proposal do **not** consume quota.
    - Internal retry attempts for the same request must never double-charge or deduct multiple messages.
12. **Exhaustion Enforcement:** Once the daily quota is exhausted, subsequent requests are blocked with an explanatory error message displaying the reset time (`00:00 UTC`) and an upgrade link.

### BR-SUB-02: Account Workspace Subscription & Capacity Invariants
1. **Scope:** Belongs to the `Account` and governs all Workspaces owned by that Account.
2. **Plan Limits:**
   - `Free`: Maximum 1 Workspace, Maximum 3 Projects across the Account.
   - `Pro`: Maximum 3 Workspaces, Maximum 7 Projects across the Account.
   - `Enterprise`: Maximum 10 Workspaces, Maximum 15 Projects across the Account.
   - `Epic`: Unlimited Workspaces, Maximum 25 Projects across the Account.
3. **Aggregate Project Counting:**
   - Project capacity is measured **in aggregate across all Workspaces** owned by the Account, not per Workspace.
   - **Archived Projects count** toward the Project limit.
   - **Soft-deleted Projects do NOT count** toward the Project limit.
   - An empty Workspace consumes zero Project slots.
   - Moving a Project between Workspaces within the same Account does not alter the aggregate Project count.
4. **Pricing & Billing Terms:**
   - Paid subscriptions are billed on a **monthly** cadence in MVP (annual billing is deferred).
   - Exact monetary prices are **`TBD`** and must be finalized before payment launch.

### BR-SUB-03: Lifecycle, 7-Day Grace Period & Downgrade/Upgrade Invariants
1. **Failed Payment & Grace Period:**
   - If a monthly renewal payment fails, the Account transitions to **`Past Due`** and enters a mandatory **7-day grace period**.
   - During the grace period, all existing plan benefits continue, but the Account cannot exceed its current plan capacity.
2. **Downgrade to Free Restrictions & Invariants:**
   - If payment is not resolved after 7 days, the Account is restricted to **Free-plan limits** (max 1 Workspace, max 3 Projects across the Account).
   - **Zero Automatic Data Deletion:** Customer project and task data is never deleted due to a plan downgrade.
   - **Explicit Owner Project Selection:** The Account Owner must explicitly select up to 3 Projects to remain editable under Free limits. The system shall **never** automatically select the three most recently updated Projects or select any Projects using another implicit rule.
   - **Temporary Read-Only Hold for All Projects:** Until the Account Owner completes this selection, **all Projects in that Account remain temporarily Read-only**.
   - **Post-Selection State:** After the Owner confirms the selection, only the selected eligible Projects may become editable, subject to their existing lifecycle state and permissions. All unselected Projects remain Read-only.
   - **Distinct State Separation (`Read-only` vs `Archived` vs `Soft-deleted`):** `Read-only` is an access tier constraint due to subscription limits, distinct from `Archived` (voluntary freeze) or `Soft-deleted` (trash).
   - **Archived Project Preservation:** If the Owner selects an Archived Project, it remains Archived (selecting an archived Project does not automatically unarchive it). Soft-deleted projects remain soft-deleted.
   - **Partial Selection (<3 Projects):** If the Owner selects fewer than 3 Projects, only the selected Projects become eligible for editing; the system does not fill unused slots automatically.
3. **Upgrade & Project Reactivation:**
   - Upgrades to higher tiers activate strictly upon **trusted payment confirmation** (e.g., verified billing webhook), never client-side redirects.
   - When an Account is upgraded, projects that became `Read-only` during a downgrade do **not** automatically become editable. The Account Owner must explicitly select which projects to reactivate within the new capacity limit.
   - Archived projects remain archived unless explicitly unarchived.
4. **Manual Cancellation:** Manual subscription cancellation leaves paid benefits active until the end of the current billing cycle.

---

## 7. Audit Logging Invariants

### BR-AUD-01: Immutable Audit Trail
The system maintains an append-only `ActivityLog` table. Audit records cannot be modified or deleted by any user, including Account Owners.

The following operations trigger automatic audit logging:
1. `ACCOUNT_CREATED`, `ACCOUNT_UPDATED`, `ACCOUNT_OWNERSHIP_TRANSFERRED`
2. `WORKSPACE_CREATED`, `WORKSPACE_UPDATED`, `WORKSPACE_ARCHIVED`, `WORKSPACE_DELETED`
3. `MEMBER_INVITED`, `MEMBER_JOINED`, `MEMBER_REMOVED`, `MEMBER_ROLE_CHANGED`
4. `PROJECT_CREATED`, `PROJECT_ARCHIVED`, `PROJECT_UNARCHIVED`, `PROJECT_DELETED`, `PROJECT_RESTORED`
5. `PROJECT_READ_ONLY_STATUS_CHANGED`, `PROJECT_SELECTION_CONFIRMED`
6. `TASK_CREATED`, `TASK_STATUS_CHANGED`, `TASK_REOPENED`, `TASK_REINSTATED`, `TASK_ASSIGNED`, `TASK_UNASSIGNED`, `TASK_SOFT_DELETED`, `TASK_RESTORED`, `TASK_PURGED`
7. `TASK_CREATED_VIA_AI`, `TASK_UPDATED_VIA_AI`, `PROJECT_CREATED_VIA_AI`, `PROJECT_UPDATED_VIA_AI`
8. `SUBSCRIPTION_STATUS_CHANGED`, `PAYMENT_FAILED_GRACE_PERIOD_STARTED`, `ACCOUNT_DOWNGRADED_FREE`, `AI_SUBSCRIPTION_PAYMENT_FAILED_GRACE_PERIOD_STARTED`, `AI_SUBSCRIPTION_DOWNGRADED_FREE`
9. `AI_QUERY_EXECUTED` (Records sanitized prompt metadata, user ID, workspace ID, token usage; raw secrets omitted)

---

## 8. Veyro AI Assistant Business Rules & Safety Invariants

### BR-AI-01: Dual Assistant Modes & Confirmed Mutation Invariant
1. The Veyro AI Assistant operates in two distinct functional modes:
   - **Mode A: Veyro Knowledge Assistant (Shared Public Corpus):** Answers user questions regarding Veyro's product features, user documentation, workflows, and governance rules using a curated, static, unprivileged public documentation corpus. Contains zero private customer data. **Strictly read-only.** Accessible to any authenticated user with or without a Workspace.
   - **Mode B: Workspace Project Assistant (Tenant Workspace Corpus):** Answers operational questions regarding projects, tasks, assignees, deadlines, and project health within the active workspace. **Supports confirmed write operations for Projects and Tasks.**
2. **Confirmed Write Scope:** The AI Assistant may propose mutations strictly within the authorized boundaries defined in `BR-AI-08`. All mutations require explicit user confirmation and atomic backend execution (`BR-AI-09`).

### BR-AI-02: Pre-LLM Tenant & Project Scoping Invariant
1. **The LLM is Never an Authorization Boundary:** System prompts and instructions to the LLM cannot be relied upon to filter private or cross-tenant data.
2. **Pre-LLM Retrieval Enforcement:** All contextual data retrieval must be strictly filtered and authorized in the database query layer prior to prompt assembly:
   - Scoped strictly to `workspaceId = :activeWorkspaceId`.
   - **Role-Based Project Scoping:**
     - Account Owners and Workspace Admins possess workspace-wide project visibility across all projects in the active workspace.
     - Standard Workspace Members are strictly restricted to projects where an active `ProjectMembership` record exists linking them to the project (`projectId IN (:userAssignedProjectIds)`). Unassigned private projects are completely excluded from retrieval.

### BR-AI-03: Grounded Citations & Honest Fallback Invariant
1. **Source Grounding:** The assistant must ground all factual answers in the retrieved context. For Workspace queries, the response must provide structured citations linking to specific Task Keys (e.g., `[TASK-101]`) or Project IDs. For Knowledge queries, citations must reference the source documentation section or URL.
2. **Honest Fallback Requirement:** If the retrieval step returns no matching records, or if the confidence/similarity score is below the operational threshold, the assistant must explicitly communicate insufficient information (`"I do not have enough information to answer that question based on current workspace records."`) rather than fabricating answers, estimating deadlines, or assuming task statuses.

### BR-AI-04: Prompt Injection Defense & Untrusted Data Boundaries
1. **Data Untrustworthiness:** All user prompts and retrieved database contents (task titles, descriptions, comments) are treated as untrusted data strings.
2. **Delimiter Isolation:** Retrieved context must be wrapped in explicit boundary delimiters (e.g., `<untrusted_context> ... </untrusted_context>`) when injected into the LLM prompt.
3. **Instruction Immunity:** The system prompt must explicitly command the LLM to treat all text within context delimiters as raw factual data and strictly ignore any instructions, system commands, or prompt overrides embedded within task or comment text.

### BR-AI-05: AI Auditability, Chat History & Cache Multi-Tenant Isolation
1. Every AI query generates an immutable audit record in `ActivityLog` (`AI_QUERY_EXECUTED`), capturing `userId`, `workspaceId`, query mode, token count, and execution latency.
2. Application logs and telemetry must sanitize user queries, stripping API keys, password patterns, or personal authentication tokens before persisting log lines.
3. **Chat History & Cache Partitioning:** Conversation history records and any future semantic response caches must be partitioned strictly by `(workspaceId, userId)`. Global or cross-tenant cache keys are strictly prohibited to prevent data leakage across Workspaces or users.

### BR-AI-06: Vector Storage Representation of Shared vs Tenant Knowledge
1. **Approved Architectural Direction (DEC-12):** Vector embeddings and similarity search are hosted within PostgreSQL using the `pgvector` extension.
2. **Implementation Validation Gates:** Prior to implementation, engineering must verify `pgvector` extension support on the selected hosting platform (Neon or Supabase) and benchmark vector retrieval performance under multi-tenant conditions (*Status: NOT RUN — scheduled for implementation phase*).
3. **Knowledge Corpus Representation:**
   - **Shared Public Documentation Index:** Static public documentation chunks reside in a dedicated unpartitioned table `knowledge_base_embeddings` (or pre-compiled static index) without a tenant ID, or a table where tenant ID IS NULL designates public shared documentation.
   - **Tenant Workspace Embeddings:** Workspace task and project embeddings must declare `workspaceId UUID NOT NULL` and include a compound index `(workspaceId, id)`.
4. **Retrieval Isolation:** All vector similarity queries for Workspace mode must explicitly filter `WHERE workspaceId = :activeWorkspaceId` alongside cosine distance ordering to prevent cross-tenant vector leakage.

### BR-AI-07: External LLM Data Transmission & Privacy Boundary
1. **Approved Architectural Direction (DEC-13):** External commercial LLM API integration operates through a provider-agnostic adapter interface (`LlmProviderService`). Concrete provider selection (OpenAI, Anthropic, etc.) is explicitly deferred to the implementation phase.
2. **Model Training Prohibition Invariant:** Customer workspace data must strictly **NOT** be used for model training or fine-tuning under any circumstances.
3. **Pre-Selection Contractual Privacy Review:** Prior to selecting and onboarding any LLM provider, engineering must formally review the provider's actual contractual retention periods, logging practices, deletion mechanisms, subprocessors, and Data Processing Addendum (DPA) terms. The team must **not assume Zero Data Retention (ZDR)** without verified contractual evidence.
4. **Transmission Scope:** Only sanitized user queries and authorized context snippets may be sent to the external LLM provider API.
5. **Prohibited Egress:** System credentials, session tokens, passwords, database URLs, cross-tenant data, and data from unassigned projects must never be transmitted to external LLMs. Context injected into prompts must be quarantined within `<untrusted_context>` tags.

### BR-AI-08: AI Project & Task Mutation Boundaries
1. **Permitted Project Mutations:**
   - Create a Project (within authorized Workspace and subject to Account project capacity).
   - Update Project `Name` and `Description`.
2. **Permitted Task Mutations:**
   - Create a Task within an authorized Project.
   - Update Task `Title`, `Description`, `Status`, `Assignee`, `Due Date`, and `Priority`.
3. **Explicitly Prohibited AI Actions:** The AI Assistant must **never**:
   - Delete Projects or Tasks.
   - Archive or unarchive Projects.
   - Create, edit, or delete Comments.
   - Mutate memberships, roles, or permissions.
   - Bypass any established Project, Task, or Account business rules.

### BR-AI-09: AI Mutation Proposal & User Confirmation Invariant
1. **Structured Change Proposal:** When the AI detects a mutation request, it must synthesize a structured change proposal presented clearly in the UI. Generating this proposal consumes exactly **1 AI message** from the User's daily quota upon successful synthesis, even if the user subsequently reviews and rejects the proposal.
2. **Explicit User Confirmation:** The user must explicitly inspect and confirm the proposal before any mutation is applied. Confirming and executing an already-generated proposal consumes **0 additional AI messages** (ordinary UI execution does not count as an AI message).
3. **Backend Execution Revalidation:** The approval dialog is not an authorization boundary. Upon confirmation, the backend revalidates:
   - User's actual permissions and active membership in the Workspace and Project.
   - Project active status (not archived or soft-deleted).
   - Account subscription capacity (project limits).
   - Task state machine rules and assignee eligibility.
4. **Atomic All-or-Nothing Execution:** Related changes within a single approved operation must execute inside an atomic database transaction (`prisma.$transaction`). If any part fails, the entire transaction rolls back cleanly with zero partial changes persisted.

---

## 9. Baseline Decision Status & AI Architecture

All foundational product and technical architecture decisions have agreed directions:
- **DEC-01 through DEC-11:** `APPROVED` (Branding, Shared DB Multi-tenancy, NestJS Auth, Copyable Invites, Private Projects, Hybrid Deletion, Admin Project Creation, Decoupled Onboarding, Strict Email Match, Task Reopening Governance, 30-Day Purge).
- **DEC-12 (AI Assistant Vector Storage & Retrieval Strategy):** `APPROVED (DIRECTIONAL)` — Architectural direction: PostgreSQL + `pgvector`. Preconditions for implementation: hosting platform support verification (Neon/Supabase) and retrieval performance benchmarking (*Status: NOT RUN — scheduled for implementation phase*).
- **DEC-13 (External LLM Provider Integration & Data Privacy Policy):** `APPROVED (DIRECTIONAL)` — Architectural direction: Commercial LLM API via provider-agnostic adapter. Concrete provider selection is deferred to implementation. Strict customer data model training ban; contractual review of retention periods, logging, deletion, subprocessors, and DPA required prior to selection without assuming Zero Data Retention.
- **DEC-14 (Product Conceptual Hierarchy & Ownership Boundary):** `APPROVED` — Hierarchy: `User → Account → Workspaces → Projects → Tasks`. Account is billing and multi-workspace boundary; Workspace is collaborative space; User is global identity.
- **DEC-15 (Personal AI Subscription Tiers & Daily Message Quotas):** `APPROVED` — Personal quotas (Free: 3, Pro: 15, Enterprise: 25, Epic: 50 msgs/day), resetting daily at 00:00 UTC. Independent of Workspaces. Technical failures do not consume quota.
- **DEC-16 (Account Workspace Subscriptions & Capacity Lifecycle):** `APPROVED` — Account-level limits (Free: 1 WS / 3 Projects; Pro: 3 WS / 7 Projects; Enterprise: 10 WS / 15 Projects; Epic: Unl WS / 25 Projects across Account). Aggregate project counts; 7-day payment grace period; Free-plan downgrade holds all projects temporarily Read-only until Owner explicitly selects up to 3 editable projects (no implicit auto-selection); zero data deletion; archived projects remain archived; partial selections respected; manual reactivation required on later upgrade. Monthly billing; exact prices TBD.
- **DEC-17 (Veyro AI Assistant Confirmed Write Operations in Project Mode):** `APPROVED` — Permitted writes for Project (create, update name/description) and Task (create, update title/desc/status/assignee/due date/priority). Prohibits deletions, archival, comments, and permissions.
- **DEC-18 (AI Mutation Proposal & User Confirmation Flow):** `APPROVED` — Structured proposal, explicit user confirmation, backend permission revalidation, and atomic all-or-nothing execution.
- **DEC-19 (Workspace-Scoped Invitations & Isolation):** `APPROVED` — Invitations target a specific Workspace and grant access solely to that Workspace.
- **DEC-20 (Cross-Account Project Transfer Scope):** `DEFERRED POST-MVP` — Moving projects between distinct billing Accounts is deferred to a future phase.
- **DEC-21 (Commercial Pricing & Payment Gateway Selection):** `TBD / DEFERRED` — Exact monetary pricing and payment provider integration choices are deferred to technical implementation.
- **DEC-22 (Personal AI Subscription Payment Failure, Grace Period, and Cancellation Lifecycle):** `APPROVED` — Paid AI subscriptions renew monthly in MVP; renewal payment failure enters `Past Due` with a 7-day grace period maintaining full plan quota; unpaid after grace downgrades to Free (3 msgs/day) with zero deletion of user account, project data, or conversation history; manual cancellation preserves benefits until billing period ends; activation requires trusted server payment confirmation; strictly decoupled from Account Workspace/Project limits.
- **DEC-23 (AI Message Consumption for Proposals and Confirmation):** `APPROVED` — A successfully generated AI response or change proposal consumes exactly 1 AI message, even if rejected; confirming/executing an already-generated proposal consumes 0 additional messages; technical failures do not consume quota; internal retries never double-charge; backend revalidation and atomic all-or-nothing execution enforced on confirmation.

Complete details, trade-offs, and alternatives are tracked in [`DECISIONS-TO-APPROVE.md`](./DECISIONS-TO-APPROVE.md).
