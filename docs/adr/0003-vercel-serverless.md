# 0003. Both apps on Vercel serverless for the demo, and when to move

**Status:** accepted · **Date:** 2026-10-29 (Phase 6)

## Context

Veyro needs a public demo that costs nothing to run, deploys on every push and stays up without anyone watching it. The frontend is Next.js; the backend is a NestJS API that was written as a long-running server.

## Decision

Two Vercel projects from this repository: `frontend/` and `backend/` (NestJS on Vercel's zero-configuration support), with Neon PostgreSQL through its pooled connection. The browser only talks to the frontend; Next.js forwards `/api/v1` to the API, so the session cookies are first-party and no CORS dance is needed for normal use. A Docker image and a compose file are kept as a tested local and self-host option, not as the deployment.

Making a long-running server safe on serverless took these changes:

- **Nothing important in memory.** Sessions are cookies, AI limits are in the database, OAuth state is a cookie, and the database connection is pooled by Neon.
- **Work after the response runs inside `waitUntil`**, because a function can be frozen as soon as it answers. Emails were silently lost before this.
- **Scheduled work is a protected endpoint** (`GET /api/v1/jobs/daily`, needs `CRON_SECRET`) that Vercel Cron calls once a day, and every job is safe to run twice.
- **`TRUST_PROXY=1`** so the rate limiter and the contact form see the visitor's address, not Vercel's.
- **CommonJS dependencies**, because the runtime could not `require()` ESM-only packages (`@nestjs/jwt` and `@nestjs/passport` had to stay on their CommonJS releases).

## Alternatives

- **A container host** (Render, Railway, Fly.io) for the API. Closer to how the API was written and no cold starts, but a free tier that sleeps behaves worse than serverless, and an always-on one costs money for a demo.
- **A VPS with Docker.** Full control, but patching, TLS and uptime become my job.
- **Frontend on Vercel, API elsewhere.** Cross-site cookies and CORS for every request, for no gain at this size.

## Consequences

- Free, deployed on every push, and quiet when nobody uses it.
- **The rate limiter is best-effort**: it counts per function instance, so a burst spread over instances is not fully limited.
- Cold starts make the first request after a quiet period slow.
- Request bodies are capped at 4.5 MB, which is why task files go straight to Cloudinary (see [0005](0005-private-task-files.md)).
- Cron on the free plan runs at most daily, within an hour window.

## Revisit when

Any one of these is true, move the API to a container host using the existing Docker image:

- the rate limiter must be exact (move its counters to Redis first, which also works on serverless);
- jobs must run more often than daily, or need queues and retries;
- requests need bodies over 4.5 MB or run longer than the function limit;
- users notice cold starts.
