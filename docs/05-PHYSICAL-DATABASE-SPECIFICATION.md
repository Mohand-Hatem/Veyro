# 05. Physical Database Specification: Veyro

**Document Version:** 1.0.0  
**Phase:** Phase 2 — System Design & Architecture  
**Step:** STEP-2.2: Physical Database Schema Design (`schema.prisma` & PostgreSQL Specification)  
**Status:** PHASE 2 — STEP-2.2 COMPLETED  
**Date:** October 12, 2026  
**ORM Target:** Prisma ORM 7 (`@prisma/client@^7.0.0`, `prisma@^7.0.0`) / Node.js 22 LTS  
**Database Target:** PostgreSQL 16+  
**Parent Documents:** [`docs/01-PROJECT-BRIEF.md`](./01-PROJECT-BRIEF.md), [`docs/02-USER-ROLES-AND-FLOWS.md`](./02-USER-ROLES-AND-FLOWS.md), [`docs/03-BUSINESS-RULES.md`](./03-BUSINESS-RULES.md), [`docs/04-ENTITY-RELATIONSHIP-SPECIFICATION.md`](./04-ENTITY-RELATIONSHIP-SPECIFICATION.md)

---

## 1. Architectural Overview & Core Principles

This specification translates the approved conceptual data model ([`docs/04-ENTITY-RELATIONSHIP-SPECIFICATION.md`](./04-ENTITY-RELATIONSHIP-SPECIFICATION.md)) into an enterprise-ready, portfolio-grade physical relational schema implemented via **Prisma ORM 7** targeting **PostgreSQL 16+**.

### Settled Architectural Decisions & Rationale

1. **D-1: Primary Key Strategy — CUID2 (`@default(cuid(2))`):**
   - Implemented across all 19 models.
   - **Why CUID2:** Natively supported in Prisma 7 (`@default(cuid(2))`). Provides collision-resistant, cryptographically random, URL-friendly identifiers (`clh...`) optimal for frontend routing, API ergonomics, and multi-tenant security (mitigates sequential ID enumeration attacks).
   - In raw SQL queries or manual seed scripts, IDs are generated via `@paralleldrive/cuid2`.

2. **D-2: Tenancy & Hierarchy Normalization — Pure 3NF:**
   - Strict hierarchical chaining: `Task -> Project -> Workspace -> Account`.
   - Denormalized `workspaceId` is intentionally excluded from `Task` and `TaskComment`.
   - **Why:** Eliminates data mismatch anomalies where a task could point to a workspace that differs from its project's workspace. Authorization guards query up the relational hierarchy safely via Prisma `include`/`select` joins.

3. **D-3: Project Downgrade & Billing Hold — Boolean Flag:**
   - Single attribute: `Project.isBillingReadOnly: Boolean @default(false)`.
   - **Why:** When an Account subscription downgrades to Free, projects exceeding the 3-project capacity are marked `isBillingReadOnly = true`. This flag persists across subscription renewals until the Account Owner explicitly reactivates projects within authorized tier limits.

4. **D-4: AI Quota Ledger & Request-Level Idempotency — `AiUsageReservation`:**
   - Minimal supporting ledger model: `AiUsageReservation` with status enum `PENDING | FINALIZED | COMPENSATED`.
   - Enforces unique `(userId, idempotencyKey)` and stores a 64-character canonical SHA-256 `requestHash`.
   - **Atomic Transaction:** Reservation insertion and `AiDailyUsage.messagesUsed` increment occur in a single database transaction (`prisma.$transaction`).
   - On retry:
     - `PENDING`: Request is in flight (`409 Conflict`).
     - `FINALIZED`: Verified hash match returns pointer to existing assistant message (`finalizedMessageId`) without calling LLM or charging quota.
     - `COMPENSATED`: Handled as failed, allowing clean replay.
   - Zero duplication of LLM payload content in the reservation table.

5. **D-5: Operational Deletion Strategy — Option A (Restrictive FKs + Child-First Purge):**
   - Database foreign keys enforce `ON DELETE RESTRICT` on business relationships to prevent accidental cascading deletion during everyday operations.
   - Deletions are executed via structured application service scripts that traverse children first inside an explicit transaction:
     `TaskComment -> Task -> ProjectMember -> Project -> WorkspaceInvitation -> WorkspaceMember -> Workspace -> Account`.
   - Transient sessions (`UserSession`) and conversation messages (`AiMessage`, `AiMutationProposal`) use `ON DELETE CASCADE` because they represent private child state with zero audit value once the parent session/conversation is purged.

6. **D-10: Audit Log Isolation & Immutability:**
   - `AuditLog` records store raw snapshot identifiers (`actorUserId`, `accountId`, `workspaceId`, `projectId`, `taskId`) without foreign key constraints.
   - **Why:** Guarantees append-only immutability. Account or workspace purges never delete historical audit logs, and foreign key locks are never acquired on the high-throughput audit table during transactional operations.

7. **D-13: Account Offboarding State Machine:**
   - Single enum on Account: `offboardingState: NONE | PENDING | COMPLETED`.
   - Transitions to `PENDING` upon owner offboarding request. Application guards immediately reject all concurrent mutation requests across all subsidiary workspaces while offboarding is in progress (`403 Forbidden`).

---

## 2. Physical Model Catalog

The physical database consists of **19 relational tables** mapped to snake_case names in PostgreSQL:

| # | Prisma Model | Table Name | Block | Responsibility | Primary Key |
|---|--------------|------------|-------|----------------|-------------|
| 1 | `User` | `users` | Identity | Unified identity & credentials | CUID2 |
| 2 | `UserSession` | `user_sessions` | Identity | Long-lived refresh sessions & family rotation | CUID2 |
| 3 | `Account` | `accounts` | Tenancy | Root billing & capacity container | CUID2 |
| 4 | `Workspace` | `workspaces` | Tenancy | Operational collaboration container | CUID2 |
| 5 | `WorkspaceMember` | `workspace_members` | Tenancy | User-workspace role junction | CUID2 |
| 6 | `WorkspaceInvitation` | `workspace_invitations` | Tenancy | Hashed invite token records | CUID2 |
| 7 | `Project` | `projects` | Task Mgmt | Private project container | CUID2 |
| 8 | `ProjectMember` | `project_members` | Task Mgmt | User-project access junction | CUID2 |
| 9 | `Task` | `tasks` | Task Mgmt | Actionable work item | CUID2 |
| 10 | `TaskComment` | `task_comments` | Task Mgmt | Discussion comments & reopen reason thread | CUID2 |
| 11 | `AccountSubscription` | `account_subscriptions` | Billing | Aggregate account tier limits | CUID2 |
| 12 | `UserAiSubscription` | `user_ai_subscriptions` | Billing | Personal daily AI quota entitlement | CUID2 |
| 13 | `BillingEvent` | `billing_events` | Billing | Gateway webhook idempotency & payment logs | CUID2 |
| 14 | `AiDailyUsage` | `ai_daily_usages` | AI Ledger | Daily UTC quota consumption counter | CUID2 |
| 15 | `AiUsageReservation` | `ai_usage_reservations` | AI Ledger | Request-level idempotency & quota reservation | CUID2 |
| 16 | `AiConversation` | `ai_conversations` | AI Chat | Scoped conversational sessions | CUID2 |
| 17 | `AiMessage` | `ai_messages` | AI Chat | Prompts, responses, and citations | CUID2 |
| 18 | `AiMutationProposal` | `ai_mutation_proposals` | AI Chat | Structured candidate mutation proposals | CUID2 |
| 19 | `AuditLog` | `audit_logs` | Compliance | Tamper-evident operational audit trail | CUID2 |

---

## 3. Enumerated Types (PostgreSQL Enums)

| Enum Name | Values | Usage |
|-----------|--------|-------|
| `AccountOffboardingState` | `NONE`, `PENDING`, `COMPLETED` | Account offboarding lifecycle coordination |
| `WorkspaceLifecycleStatus` | `ACTIVE`, `ARCHIVED` | Operational workspace availability |
| `WorkspaceRole` | `ADMIN`, `MEMBER` | Role-based access control inside a workspace |
| `InvitationStatus` | `PENDING`, `ACCEPTED`, `REVOKED`, `EXPIRED` | Workspace invitation state machine |
| `ProjectLifecycleStatus` | `ACTIVE`, `ARCHIVED` | Project operational workflow state |
| `TaskStatus` | `TODO`, `IN_PROGRESS`, `IN_REVIEW`, `DONE`, `CANCELLED` | Task lifecycle state machine |
| `TaskPriority` | `LOW`, `MEDIUM`, `HIGH`, `URGENT` | Task prioritization |
| `SubscriptionPlanTier` | `FREE`, `PRO`, `ENTERPRISE`, `EPIC` | Account plan tier |
| `AiPlanTier` | `FREE`, `PRO`, `ENTERPRISE`, `EPIC` | User personal AI plan tier |
| `SubscriptionPaymentStatus` | `ACTIVE`, `PAST_DUE`, `DOWNGRADED` | Payment lifecycle & grace period status |
| `AiReservationStatus` | `PENDING`, `FINALIZED`, `COMPENSATED` | AI quota reservation state |
| `AiMode` | `KNOWLEDGE`, `PROJECT` | AI assistant context mode |
| `AiContextScope` | `GLOBAL`, `WORKSPACE`, `ACCOUNT` | AI context boundary scope |
| `AiSenderRole` | `USER`, `ASSISTANT` | Chat message origin role |
| `AiProposalTargetType` | `PROJECT`, `TASK` | Target entity for AI mutation proposal |
| `AiProposalMutationType` | `CREATE`, `UPDATE` | Mutation action type |
| `AiProposalStatus` | `PENDING`, `CONFIRMED`, `REJECTED`, `EXECUTED`, `FAILED` | Human approval proposal state |

---

## 4. Detailed Table Specifications & Indexing Strategy

### 4.1. Identity & Session Block

#### `users`
- **Columns:**
  - `id`: `VARCHAR(32)` PRIMARY KEY (`cuid(2)`)
  - `email`: `VARCHAR(255)` NOT NULL UNIQUE
  - `password_hash`: `VARCHAR(255)` NOT NULL
  - `name`: `VARCHAR(255)` NOT NULL
  - `avatar_url`: `TEXT` NULL
  - `created_at`: `TIMESTAMPTZ` NOT NULL DEFAULT `NOW()`
  - `updated_at`: `TIMESTAMPTZ` NOT NULL
- **Indexes:**
  - `users_email_key` (UNIQUE)

#### `user_sessions`
- **Columns:**
  - `id`: `VARCHAR(32)` PRIMARY KEY (`cuid(2)`)
  - `user_id`: `VARCHAR(32)` NOT NULL REFERENCES `users(id)` ON DELETE CASCADE
  - `hashed_token`: `VARCHAR(64)` NOT NULL UNIQUE (SHA-256)
  - `family_id`: `VARCHAR(64)` NOT NULL
  - `is_revoked`: `BOOLEAN` NOT NULL DEFAULT `FALSE`
  - `expires_at`: `TIMESTAMPTZ` NOT NULL
  - `created_at`: `TIMESTAMPTZ` NOT NULL DEFAULT `NOW()`
- **Indexes:**
  - `user_sessions_user_id_idx` on `(user_id)`
  - `user_sessions_family_id_idx` on `(family_id)`
  - `user_sessions_hashed_token_key` (UNIQUE)

### 4.2. Tenancy & Collaboration Block

#### `accounts`
- **Columns:**
  - `id`: `VARCHAR(32)` PRIMARY KEY (`cuid(2)`)
  - `name`: `VARCHAR(255)` NOT NULL
  - `slug`: `VARCHAR(255)` NOT NULL UNIQUE
  - `owner_id`: `VARCHAR(32)` NOT NULL REFERENCES `users(id)` ON DELETE RESTRICT
  - `offboarding_state`: `AccountOffboardingState` NOT NULL DEFAULT `NONE`
  - `created_at`: `TIMESTAMPTZ` NOT NULL DEFAULT `NOW()`
  - `updated_at`: `TIMESTAMPTZ` NOT NULL
- **Indexes:**
  - `accounts_slug_key` (UNIQUE)
  - `accounts_owner_id_idx` on `(owner_id)`

#### `workspaces`
- **Columns:**
  - `id`: `VARCHAR(32)` PRIMARY KEY (`cuid(2)`)
  - `account_id`: `VARCHAR(32)` NOT NULL REFERENCES `accounts(id)` ON DELETE RESTRICT
  - `name`: `VARCHAR(255)` NOT NULL
  - `slug`: `VARCHAR(255)` NOT NULL UNIQUE
  - `lifecycle_status`: `WorkspaceLifecycleStatus` NOT NULL DEFAULT `ACTIVE`
  - `created_at`: `TIMESTAMPTZ` NOT NULL DEFAULT `NOW()`
  - `updated_at`: `TIMESTAMPTZ` NOT NULL
- **Indexes:**
  - `workspaces_slug_key` (UNIQUE)
  - `workspaces_account_id_idx` on `(account_id)`

#### `workspace_members`
- **Columns:**
  - `id`: `VARCHAR(32)` PRIMARY KEY (`cuid(2)`)
  - `workspace_id`: `VARCHAR(32)` NOT NULL REFERENCES `workspaces(id)` ON DELETE RESTRICT
  - `user_id`: `VARCHAR(32)` NOT NULL REFERENCES `users(id)` ON DELETE RESTRICT
  - `role`: `WorkspaceRole` NOT NULL DEFAULT `MEMBER`
  - `joined_at`: `TIMESTAMPTZ` NOT NULL DEFAULT `NOW()`
- **Indexes:**
  - `workspace_members_workspace_id_user_id_key` UNIQUE `(workspace_id, user_id)`
  - `workspace_members_user_id_idx` on `(user_id)`

#### `workspace_invitations`
- **Columns:**
  - `id`: `VARCHAR(32)` PRIMARY KEY (`cuid(2)`)
  - `workspace_id`: `VARCHAR(32)` NOT NULL REFERENCES `workspaces(id)` ON DELETE RESTRICT
  - `inviter_id`: `VARCHAR(32)` NOT NULL REFERENCES `users(id)` ON DELETE RESTRICT
  - `email`: `VARCHAR(255)` NOT NULL
  - `role`: `WorkspaceRole` NOT NULL DEFAULT `MEMBER`
  - `hashed_token`: `VARCHAR(64)` NOT NULL UNIQUE
  - `status`: `InvitationStatus` NOT NULL DEFAULT `PENDING`
  - `expires_at`: `TIMESTAMPTZ` NOT NULL
  - `created_at`: `TIMESTAMPTZ` NOT NULL DEFAULT `NOW()`
- **Indexes:**
  - `workspace_invitations_hashed_token_key` (UNIQUE)
  - `workspace_invitations_workspace_id_email_idx` on `(workspace_id, email)`
  - `workspace_invitations_status_expires_at_idx` on `(status, expires_at)`

### 4.3. Projects & Task Execution Block

#### `projects`
- **Columns:**
  - `id`: `VARCHAR(32)` PRIMARY KEY (`cuid(2)`)
  - `workspace_id`: `VARCHAR(32)` NOT NULL REFERENCES `workspaces(id)` ON DELETE RESTRICT
  - `name`: `VARCHAR(255)` NOT NULL
  - `description`: `TEXT` NULL
  - `lifecycle_status`: `ProjectLifecycleStatus` NOT NULL DEFAULT `ACTIVE`
  - `deleted_at`: `TIMESTAMPTZ` NULL
  - `is_billing_read_only`: `BOOLEAN` NOT NULL DEFAULT `FALSE`
  - `created_at`: `TIMESTAMPTZ` NOT NULL DEFAULT `NOW()`
  - `updated_at`: `TIMESTAMPTZ` NOT NULL
- **Indexes:**
  - `projects_workspace_id_lifecycle_status_idx` on `(workspace_id, lifecycle_status)`
  - `projects_workspace_id_deleted_at_idx` on `(workspace_id, deleted_at)`

#### `project_members`
- **Columns:**
  - `id`: `VARCHAR(32)` PRIMARY KEY (`cuid(2)`)
  - `project_id`: `VARCHAR(32)` NOT NULL REFERENCES `projects(id)` ON DELETE RESTRICT
  - `user_id`: `VARCHAR(32)` NOT NULL REFERENCES `users(id)` ON DELETE RESTRICT
  - `assigned_at`: `TIMESTAMPTZ` NOT NULL DEFAULT `NOW()`
- **Indexes:**
  - `project_members_project_id_user_id_key` UNIQUE `(project_id, user_id)`
  - `project_members_user_id_idx` on `(user_id)`

#### `tasks`
- **Columns:**
  - `id`: `VARCHAR(32)` PRIMARY KEY (`cuid(2)`)
  - `project_id`: `VARCHAR(32)` NOT NULL REFERENCES `projects(id)` ON DELETE RESTRICT
  - `title`: `VARCHAR(255)` NOT NULL
  - `description`: `TEXT` NULL
  - `status`: `TaskStatus` NOT NULL DEFAULT `TODO`
  - `priority`: `TaskPriority` NOT NULL DEFAULT `MEDIUM`
  - `author_id`: `VARCHAR(32)` NOT NULL REFERENCES `users(id)` ON DELETE RESTRICT
  - `assignee_id`: `VARCHAR(32)` NULL REFERENCES `users(id)` ON DELETE SET NULL
  - `due_date`: `TIMESTAMPTZ` NULL
  - `deleted_at`: `TIMESTAMPTZ` NULL
  - `created_at`: `TIMESTAMPTZ` NOT NULL DEFAULT `NOW()`
  - `updated_at`: `TIMESTAMPTZ` NOT NULL
- **Indexes:**
  - `tasks_project_id_status_idx` on `(project_id, status)`
  - `tasks_project_id_deleted_at_idx` on `(project_id, deleted_at)`
  - `tasks_assignee_id_idx` on `(assignee_id)`
  - `tasks_author_id_idx` on `(author_id)`

#### `task_comments`
- **Columns:**
  - `id`: `VARCHAR(32)` PRIMARY KEY (`cuid(2)`)
  - `task_id`: `VARCHAR(32)` NOT NULL REFERENCES `tasks(id)` ON DELETE RESTRICT
  - `author_id`: `VARCHAR(32)` NOT NULL REFERENCES `users(id)` ON DELETE RESTRICT
  - `content`: `TEXT` NOT NULL
  - `deleted_at`: `TIMESTAMPTZ` NULL
  - `created_at`: `TIMESTAMPTZ` NOT NULL DEFAULT `NOW()`
  - `updated_at`: `TIMESTAMPTZ` NOT NULL
- **Indexes:**
  - `task_comments_task_id_created_at_idx` on `(task_id, created_at)`
  - `task_comments_author_id_idx` on `(author_id)`

### 4.4. Billing & Capacity Subscription Block

#### `account_subscriptions`
- **Columns:**
  - `id`: `VARCHAR(32)` PRIMARY KEY (`cuid(2)`)
  - `account_id`: `VARCHAR(32)` NOT NULL UNIQUE REFERENCES `accounts(id)` ON DELETE RESTRICT
  - `tier`: `SubscriptionPlanTier` NOT NULL DEFAULT `FREE`
  - `status`: `SubscriptionPaymentStatus` NOT NULL DEFAULT `ACTIVE`
  - `cancel_at_period_end`: `BOOLEAN` NOT NULL DEFAULT `FALSE`
  - `canceled_at`: `TIMESTAMPTZ` NULL
  - `billing_cycle_ends_at`: `TIMESTAMPTZ` NULL
  - `grace_period_ends_at`: `TIMESTAMPTZ` NULL
  - `requires_project_selection`: `BOOLEAN` NOT NULL DEFAULT `FALSE`
  - `provider_customer_id`: `VARCHAR(255)` NULL
  - `provider_subscription_id`: `VARCHAR(255)` NULL
  - `created_at`: `TIMESTAMPTZ` NOT NULL DEFAULT `NOW()`
  - `updated_at`: `TIMESTAMPTZ` NOT NULL
- **Indexes:**
  - `account_subscriptions_account_id_key` (UNIQUE)
  - `account_subscriptions_tier_status_idx` on `(tier, status)`

#### `user_ai_subscriptions`
- **Columns:**
  - `id`: `VARCHAR(32)` PRIMARY KEY (`cuid(2)`)
  - `user_id`: `VARCHAR(32)` NOT NULL UNIQUE REFERENCES `users(id)` ON DELETE RESTRICT
  - `tier`: `AiPlanTier` NOT NULL DEFAULT `FREE`
  - `daily_quota`: `INTEGER` NOT NULL DEFAULT `3`
  - `status`: `SubscriptionPaymentStatus` NOT NULL DEFAULT `ACTIVE`
  - `cancel_at_period_end`: `BOOLEAN` NOT NULL DEFAULT `FALSE`
  - `canceled_at`: `TIMESTAMPTZ` NULL
  - `billing_cycle_ends_at`: `TIMESTAMPTZ` NULL
  - `grace_period_ends_at`: `TIMESTAMPTZ` NULL
  - `provider_customer_id`: `VARCHAR(255)` NULL
  - `created_at`: `TIMESTAMPTZ` NOT NULL DEFAULT `NOW()`
  - `updated_at`: `TIMESTAMPTZ` NOT NULL
- **Indexes:**
  - `user_ai_subscriptions_user_id_key` (UNIQUE)
  - `user_ai_subscriptions_tier_status_idx` on `(tier, status)`

#### `billing_events`
- **Columns:**
  - `id`: `VARCHAR(32)` PRIMARY KEY (`cuid(2)`)
  - `account_subscription_id`: `VARCHAR(32)` NULL REFERENCES `account_subscriptions(id)` ON DELETE SET NULL
  - `user_ai_subscription_id`: `VARCHAR(32)` NULL REFERENCES `user_ai_subscriptions(id)` ON DELETE SET NULL
  - `event_type`: `VARCHAR(100)` NOT NULL
  - `external_event_id`: `VARCHAR(255)` NOT NULL UNIQUE
  - `amount`: `INTEGER` NULL
  - `currency`: `VARCHAR(10)` NULL
  - `occurred_at`: `TIMESTAMPTZ` NOT NULL DEFAULT `NOW()`
  - `created_at`: `TIMESTAMPTZ` NOT NULL DEFAULT `NOW()`
- **Indexes:**
  - `billing_events_external_event_id_key` (UNIQUE)
  - `billing_events_account_subscription_id_idx` on `(account_subscription_id)`
  - `billing_events_user_ai_subscription_id_idx` on `(user_ai_subscription_id)`

### 4.5. AI Assistant & Usage Quota Block

#### `ai_daily_usages`
- **Columns:**
  - `id`: `VARCHAR(32)` PRIMARY KEY (`cuid(2)`)
  - `user_id`: `VARCHAR(32)` NOT NULL REFERENCES `users(id)` ON DELETE RESTRICT
  - `usage_date`: `DATE` NOT NULL
  - `messages_used`: `INTEGER` NOT NULL DEFAULT `0`
  - `created_at`: `TIMESTAMPTZ` NOT NULL DEFAULT `NOW()`
  - `updated_at`: `TIMESTAMPTZ` NOT NULL
- **Indexes:**
  - `ai_daily_usages_user_id_usage_date_key` UNIQUE `(user_id, usage_date)`
  - `ai_daily_usages_usage_date_idx` on `(usage_date)`

#### `ai_usage_reservations`
- **Columns:**
  - `id`: `VARCHAR(32)` PRIMARY KEY (`cuid(2)`)
  - `user_id`: `VARCHAR(32)` NOT NULL REFERENCES `users(id)` ON DELETE RESTRICT
  - `idempotency_key`: `VARCHAR(255)` NOT NULL
  - `request_hash`: `VARCHAR(64)` NOT NULL
  - `status`: `AiReservationStatus` NOT NULL DEFAULT `PENDING`
  - `usage_date`: `DATE` NOT NULL
  - `conversation_id`: `VARCHAR(32)` NULL
  - `finalized_message_id`: `VARCHAR(32)` NULL
  - `created_at`: `TIMESTAMPTZ` NOT NULL DEFAULT `NOW()`
  - `updated_at`: `TIMESTAMPTZ` NOT NULL
- **Indexes:**
  - `ai_usage_reservations_user_id_idempotency_key_key` UNIQUE `(user_id, idempotency_key)`
  - `ai_usage_reservations_user_id_usage_date_idx` on `(user_id, usage_date)`
  - `ai_usage_reservations_status_created_at_idx` on `(status, created_at)`

#### `ai_conversations`
- **Columns:**
  - `id`: `VARCHAR(32)` PRIMARY KEY (`cuid(2)`)
  - `user_id`: `VARCHAR(32)` NOT NULL REFERENCES `users(id)` ON DELETE RESTRICT
  - `mode`: `AiMode` NOT NULL DEFAULT `KNOWLEDGE`
  - `context_scope`: `AiContextScope` NOT NULL DEFAULT `GLOBAL`
  - `account_id`: `VARCHAR(32)` NULL REFERENCES `accounts(id)` ON DELETE SET NULL
  - `workspace_id`: `VARCHAR(32)` NULL REFERENCES `workspaces(id)` ON DELETE SET NULL
  - `title`: `VARCHAR(255)` NOT NULL
  - `created_at`: `TIMESTAMPTZ` NOT NULL DEFAULT `NOW()`
  - `updated_at`: `TIMESTAMPTZ` NOT NULL
- **Indexes:**
  - `ai_conversations_user_id_updated_at_idx` on `(user_id, updated_at)`
  - `ai_conversations_workspace_id_idx` on `(workspace_id)`
  - `ai_conversations_account_id_idx` on `(account_id)`

#### `ai_messages`
- **Columns:**
  - `id`: `VARCHAR(32)` PRIMARY KEY (`cuid(2)`)
  - `conversation_id`: `VARCHAR(32)` NOT NULL REFERENCES `ai_conversations(id)` ON DELETE CASCADE
  - `sender_role`: `AiSenderRole` NOT NULL
  - `content`: `TEXT` NOT NULL
  - `citations`: `JSONB` NULL
  - `created_at`: `TIMESTAMPTZ` NOT NULL DEFAULT `NOW()`
- **Indexes:**
  - `ai_messages_conversation_id_created_at_idx` on `(conversation_id, created_at)`

#### `ai_mutation_proposals`
- **Columns:**
  - `id`: `VARCHAR(32)` PRIMARY KEY (`cuid(2)`)
  - `conversation_id`: `VARCHAR(32)` NOT NULL REFERENCES `ai_conversations(id)` ON DELETE CASCADE
  - `target_entity_type`: `AiProposalTargetType` NOT NULL
  - `mutation_action`: `AiProposalMutationType` NOT NULL
  - `target_entity_id`: `VARCHAR(32)` NULL
  - `target_workspace_id`: `VARCHAR(32)` NULL
  - `target_project_id`: `VARCHAR(32)` NULL
  - `proposed_payload`: `JSONB` NOT NULL
  - `status`: `AiProposalStatus` NOT NULL DEFAULT `PENDING`
  - `created_at`: `TIMESTAMPTZ` NOT NULL DEFAULT `NOW()`
  - `executed_at`: `TIMESTAMPTZ` NULL
- **Indexes:**
  - `ai_mutation_proposals_conversation_id_status_idx` on `(conversation_id, status)`

### 4.6. Audit & Compliance Block

#### `audit_logs`
- **Columns:**
  - `id`: `VARCHAR(32)` PRIMARY KEY (`cuid(2)`)
  - `actor_user_id`: `VARCHAR(32)` NULL
  - `account_id`: `VARCHAR(32)` NULL
  - `workspace_id`: `VARCHAR(32)` NULL
  - `project_id`: `VARCHAR(32)` NULL
  - `task_id`: `VARCHAR(32)` NULL
  - `action`: `VARCHAR(100)` NOT NULL
  - `metadata`: `JSONB` NULL
  - `created_at`: `TIMESTAMPTZ` NOT NULL DEFAULT `NOW()`
- **Indexes:**
  - `audit_logs_account_id_created_at_idx` on `(account_id, created_at)`
  - `audit_logs_workspace_id_created_at_idx` on `(workspace_id, created_at)`
  - `audit_logs_project_id_created_at_idx` on `(project_id, created_at)`
  - `audit_logs_task_id_created_at_idx` on `(task_id, created_at)`
  - `audit_logs_actor_user_id_created_at_idx` on `(actor_user_id, created_at)`

---

## 5. Traceability Matrix

| Physical Table | Conceptual Entity (`04-ERD`) | Phase 1 Requirements & Business Rules |
|----------------|------------------------------|--------------------------------------|
| `users` | `User` | `FR-1.1`, `DEC-03`, `DEC-14`, `BR-ACC-02` |
| `user_sessions` | `RefreshToken` | `FR-1.2`, `FR-1.3`, `BR-AUTH-02`, `DEC-03` |
| `accounts` | `Account` | `BR-ACC-01`, `DEC-14`, `DEC-16`, Option A |
| `workspaces` | `Workspace` | `BR-WS-01`, `DEC-14`, Option A |
| `workspace_members` | `WorkspaceMember` | `BR-WS-01`, `BR-WS-02`, `DEC-19` |
| `workspace_invitations` | `WorkspaceInvitation` | `BR-WS-02`, `DEC-04`, `DEC-09`, `FR-2.2` |
| `projects` | `Project` | `BR-PRJ-01`, `BR-PRJ-02`, `DEC-05`, `DEC-16`, `BR-SUB-03` |
| `project_members` | `ProjectMember` | `BR-PRJ-01`, `BR-TSK-03`, `DEC-05` |
| `tasks` | `Task` | `BR-TSK-01`, `BR-TSK-02`, `BR-TSK-03`, `BR-DEL-02`, `DEC-10`, `DEC-11` |
| `task_comments` | `TaskComment` | `BR-TSK-01.4`, `BR-DEL-01`, `DEC-10` |
| `account_subscriptions` | `AccountSubscription` | `BR-SUB-02`, `BR-SUB-03`, `DEC-16` |
| `user_ai_subscriptions` | `UserAiSubscription` | `BR-SUB-01`, `DEC-15`, `DEC-22` |
| `billing_events` | `BillingEvent` | `BR-SUB-01.9`, `BR-SUB-03.3` |
| `ai_daily_usages` | `AiDailyUsage` | `BR-SUB-01.4`, `DEC-15`, `DEC-23` |
| `ai_usage_reservations` | *(Physical Addition D-4)* | Request-level idempotency & atomic compensation (`BR-SUB-01.4`) |
| `ai_conversations` | `AiConversation` | `BR-AI-01`, `BR-AI-05`, `02-ROLES` Sec 1.1 |
| `ai_messages` | `AiChatMessage` | `BR-AI-03`, `BR-AI-05` |
| `ai_mutation_proposals` | `AiMutationProposal` | `BR-AI-08`, `BR-AI-09`, `DEC-17`, `DEC-18` |
| `audit_logs` | `ActivityLog` | `BR-AUD-01`, `NFR-4.1` |
