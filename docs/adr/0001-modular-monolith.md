# 0001. A modular monolith, not microservices

**Status:** accepted · **Date:** 2026-10 (Phase 2)

## Context

Veyro has about fifteen areas: auth, tenancy, projects, tasks, AI, billing, audit, notifications, storage, email, jobs, users, dashboard, contact and health. Many changes cross several of them at once. Moving a task writes the task, an audit row and a notification; removing a member unassigns their tasks and records why. One developer builds and runs it, and it is deployed as a portfolio demo.

## Decision

One NestJS application with one module per area (`backend/src/modules/*`), one PostgreSQL database and one Prisma schema. Modules call each other through their exported services, never through each other's tables in controllers. A change that must be atomic runs in one `prisma.$transaction`, even when it spans modules.

## Alternatives

- **Microservices** (for example AI, billing and the core as separate services). Each cross-area change would become a distributed transaction or an eventually consistent message flow, with retries, outboxes and partial failures to handle. That cost buys independent scaling and team autonomy, which a single developer and modest traffic do not need.
- **One flat app without module boundaries.** Faster at the start, but the AI, billing and tenancy rules would leak into each other, and nothing would show where a future split could happen.

## Consequences

- An audit row and a notification can never exist without the change they describe, and the reverse.
- One deploy, one migration history, one set of logs.
- The boundaries are a discipline, not a wall: nothing stops a module reaching into another's tables except review.
- Everything scales together. The AI calls are the slowest part and run in the same process as everything else.

## Revisit when

A part has a very different load or release rhythm from the rest. The AI gateway is the likeliest first candidate, since it already talks to the model through one class (`ai.gateway.ts`) that a queue or a separate service could take over.
