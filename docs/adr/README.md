# Architecture decision records

Short records of the decisions that shaped Veyro: the context, what was chosen, what was ruled out and when to look again. The working specifications they came from (product rules, data model, API contracts) are kept outside this repository.

| # | Decision |
| :--- | :--- |
| [0001](0001-modular-monolith.md) | One NestJS app split into modules, not microservices |
| [0002](0002-tenant-isolation.md) | Tenant isolation: scoped queries, 404 for what you cannot see, a route matrix test |
| [0003](0003-vercel-serverless.md) | Both apps on Vercel serverless for the demo, and when to move to a container host |
| [0004](0004-ai-proposes-people-confirm.md) | The AI assistant reads through scoped tools and only proposes changes |
| [0005](0005-private-task-files.md) | Private task files uploaded straight from the browser to Cloudinary |
| [0006](0006-email-demo-mode.md) | Email in an explicit demo mode while there is no domain |
