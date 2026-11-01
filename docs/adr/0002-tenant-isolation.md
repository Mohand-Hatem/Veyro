# 0002. Tenant isolation: scoped queries, 404 for what you cannot see, a route matrix test

**Status:** accepted · **Date:** 2026-10 (Phases 3 and 5)

## Context

Many companies share one database. Data belongs to an account, which owns workspaces, which hold private projects. Inside a workspace people have different rights: the account owner, workspace admins, project admins and project members. A leak between tenants, or between projects of one workspace, is the worst bug this product can have, and it is easy to introduce with one new route that forgets a check.

## Decision

Three layers, each enough on its own for the common case:

1. **Guards** resolve the caller's membership before the controller runs: `TenantGuard` for workspace routes, `ProjectAccessGuard` and `ProjectAdminGuard` for projects, `TaskAccessGuard` for tasks, `AccountOwnerGuard` for billing and the account audit trail.
2. **Services** scope every query by workspace and membership again, and decide the finer rules (who may move which task, who may open its files). Each response carries what the viewer may do (`viewer.canEdit`, `allowedStatuses`, `canUpload`…), so the UI shows only what the server allows, and hiding a button is never the protection.
3. **A test walks every route.** `backend/test/p52-isolation-matrix.spec.ts` discovers all protected routes from the running app, sends each kind of caller (anonymous, owner, admin, project admin, member, member of another project, a user of another tenant) and checks the answer. A new route that is not classified in the matrix fails the build.

Something you may not see answers `404 Not Found`, not `403 Forbidden`, so its existence does not leak: a private project id from another tenant looks exactly like an id that does not exist.

## Alternatives

- **PostgreSQL row-level security.** Strong, but it needs the tenant set on every connection, which fights with a pooled serverless connection and with Prisma, and it only covers tenant scoping, not the role rules inside a workspace.
- **A database or schema per tenant.** Real isolation, but migrations, connection counts and cost grow with every customer.
- **Checks in controllers only.** Easy to forget on the next route; the matrix test exists because of that.

## Consequences

- A forgotten check is caught by a failing test, not by a customer.
- Every new route costs one line in the matrix, which is the point.
- `404` for forbidden things makes some support questions harder ("it says not found but my colleague sees it"); the trade is worth it.

## Revisit when

Customers ask for hard isolation guarantees (compliance, very large tenants). Row-level security as an extra layer, or a dedicated database for one large tenant, would come first.
