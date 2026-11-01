# 0004. The AI assistant reads through scoped tools and only proposes changes

**Status:** accepted · **Date:** 2026-10 (Phases 3 and 5)

## Context

The assistant should answer "how does Veyro work" from the help documents, answer "what is late in my project" from real data, and help create tasks. A language model can be wrong, can be talked into things by text it reads (prompt injection, including text inside task titles), and must never see or change data the person could not see or change themselves.

## Decision

- **Help answers** come from the help documents in `backend/knowledge/`, embedded with Gemini and searched with pgvector; the answer shows its sources.
- **Workspace answers** come from read-only tools (`list_projects`, `list_tasks`, `get_task`). The user and the workspace are taken from the server session, never from the model's arguments, and membership is checked again on every message. Tool results are passed as data and the instructions say so; off-topic or injected requests get a fixed refusal.
- **Changes are proposals.** The model can only call `propose_task`, which stores an `AiMutationProposal` and shows a card. Nothing is written until the person presses Confirm. At that moment the server checks again that the proposal is still pending and that the person may still create tasks in that project, then writes the task and its audit row in one transaction. Confirming costs no message from the daily limit.
- **Daily limits by plan** use a reservation (pending, then finalized or released), so two messages sent at once cannot both slip past the limit.
- **An evaluation set** (`npm run ai:eval`, 22 cases including injection attempts) runs against the real model.

## Alternatives

- **Let the model call write tools directly.** Faster for the user, but one wrong or manipulated call changes real data with nobody looking.
- **No workspace data, help only.** Safe, but the useful questions are about your own work.
- **Send the whole workspace in the prompt.** Simple, but it leaks whatever the person may not see, and it does not fit large workspaces.

## Consequences

- The worst a bad answer can do is propose something the person rejects.
- Every change made through the assistant has a human author and an audit row.
- Answers depend on the tools: the assistant cannot answer about data no tool exposes.
- The model sometimes drafts imperfectly (for example a name in the title instead of the assignee); the confirm step is where a person catches it.

## Revisit when

There is a need for bulk or multi-step changes. A single confirm for a batch of proposals is the next step, still never writes without a person.
