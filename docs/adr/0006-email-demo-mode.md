# 0006. Email in an explicit demo mode while there is no domain

**Status:** accepted · **Date:** 2026-10-29 (Phase 6)

## Context

Veyro sends sign-up codes, password resets, invitations, contact-form copies and a new-account alert through Resend. Sending to anyone needs a verified domain. The demo has none, and Resend's test sender (`onboarding@resend.dev`) only delivers to the owner of the Resend account.

## Decision

- **Production refuses the test sender by default.** The environment check stops the API from starting when `EMAIL_FROM` is the test sender, unless `RESEND_ALLOW_TEST_SENDER=true` is set on purpose. The startup log then says the app is in demo mode.
- **The demo says so on screen.** With `NEXT_PUBLIC_DEMO_MODE=true`, the sign-up page explains that codes only reach the owner, and the sign-in page offers the three demo accounts. Google and GitHub sign-in work for everyone.
- **Sending never blocks or leaks.** It runs after the response inside `waitUntil` and never throws into the request, so a failed email cannot reveal whether an address exists.
- **Local development** prints codes and links to the console with `DEV_OUTBOX=true` instead of sending.

## Alternatives

- **Buy a domain now.** The real fix, at a small yearly cost, plus DNS setup; postponed for a demo.
- **Mark sign-ups as verified in the demo.** Removes the friction, but it puts a security shortcut in the code path that real users run.
- **A fake inbox in the app.** Shows codes to anyone, which is the same shortcut with more code.

## Consequences

- A reviewer can try everything through the demo accounts or OAuth, and is told why email sign-up is limited.
- Nobody can deploy production with the test sender by accident.
- Emails to anyone but the owner are refused by Resend, so invitations to other people do not arrive in the demo.
- The new-account alerts and contact messages still reach the owner, which doubles as a check that the email path works.

## Revisit when

A domain is bought: verify it in Resend, set `EMAIL_FROM` to it, remove `RESEND_ALLOW_TEST_SENDER` and `NEXT_PUBLIC_DEMO_MODE`. No code changes are needed.
