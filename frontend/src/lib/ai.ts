"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "./api";

// Shapes of the AI endpoints (docs/06 §2.5, CS-06 / ADR-013). The assistant is a scripted reply on the server today; the flow around it is the real one.
export type AiQuota = { tier: string; dailyQuota: number; messagesUsed: number; remaining: number; resetsAt: string };
export type AiConversation = { id: string; title: string; mode: "KNOWLEDGE" | "PROJECT"; contextScope: "GLOBAL" | "WORKSPACE" | "ACCOUNT"; workspaceId: string | null; updatedAt: string };
export type AiPriority = "URGENT" | "HIGH" | "MEDIUM" | "LOW";
/** A task the assistant drafted. Nothing is created until the person confirms; the server re-checks their rights at that moment. */
export type AiProposal = { id: string; status: "PENDING" | "EXECUTED" | "REJECTED" | "FAILED"; proposedPayload: { title: string; description?: string; priority: AiPriority }; project: { id: string; key: string; name: string } | null };
export type AiMessage = { id: string; senderRole: "USER" | "ASSISTANT"; content: string; createdAt: string; proposal?: AiProposal | null };

/** What a chat talks about: the person's one global conversation, or the one for a workspace (so two workspaces never share a thread). */
export type ChatTarget = { contextScope: "GLOBAL" } | { contextScope: "WORKSPACE"; workspaceId: string };
export const findConversation = (list: AiConversation[] | undefined, target: ChatTarget) =>
  list?.find((c) => c.contextScope === target.contextScope && (target.contextScope === "GLOBAL" || c.workspaceId === target.workspaceId));

export const useAiQuota = () => useQuery({ queryKey: ["ai", "quota"], queryFn: () => api<AiQuota>("/ai/quota") });
export const useAiConversations = () => useQuery({ queryKey: ["ai", "conversations"], queryFn: () => api<AiConversation[]>("/ai/conversations") });
export const useAiMessages = (conversationId: string | undefined) =>
  useQuery({ queryKey: ["ai", "messages", conversationId], enabled: !!conversationId, queryFn: () => api<AiMessage[]>(`/ai/conversations/${conversationId}/messages`) });

/** "05:07:09" until the daily limit renews (00:00 UTC). */
export function countdown(resetsAt: string, now: number) {
  const ms = Math.max(0, new Date(resetsAt).getTime() - now);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)}`;
}

/** The message to show for a failed send. A gateway failure refunds the message, so the same key may be reused for a retry. */
export function sendFailure(err: unknown): { key: "errGateway" | "errQuota" | "errGeneric"; keepKey: boolean } {
  const code = err instanceof ApiError ? err.code : "";
  if (code === "AI_GATEWAY_ERROR") return { key: "errGateway", keepKey: true };
  if (code === "AI_QUOTA_EXCEEDED") return { key: "errQuota", keepKey: false };
  return { key: "errGeneric", keepKey: false };
}

/** The message to show on a proposal card when confirming or rejecting failed. */
export function proposalFailure(err: unknown): "pcForbidden" | "pcResolved" | "errGeneric" {
  const code = err instanceof ApiError ? err.code : "";
  if (code === "PERMISSION_DENIED") return "pcForbidden";
  if (code === "PROPOSAL_ALREADY_RESOLVED") return "pcResolved";
  return "errGeneric";
}

/**
 * Sends one message to the conversation of the target, creating it on the first send.
 * Every send carries an Idempotency-Key (the server charges one message per key), and the caller reuses the key when it retries.
 * The thread and the quota are refetched before this resolves so the screen never shows a stale count.
 */
export function useSendMessage(conversation: AiConversation | undefined, target: ChatTarget, newTitle: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ content, key }: { content: string; key: string }) => {
      let conv = conversation;
      if (!conv) {
        const where = target.contextScope === "GLOBAL" ? { mode: "KNOWLEDGE", contextScope: "GLOBAL" } : { mode: "PROJECT", contextScope: "WORKSPACE", workspaceId: target.workspaceId };
        conv = await api<AiConversation>("/ai/conversations", { method: "POST", body: JSON.stringify({ title: content.trim().slice(0, 48) || newTitle, ...where }) });
        qc.setQueryData<AiConversation[]>(["ai", "conversations"], (old) => [conv!, ...(old ?? [])]); // a failed send must not create a second conversation on retry
      }
      await api(`/ai/conversations/${conv.id}/messages`, { method: "POST", headers: { "Idempotency-Key": key }, body: JSON.stringify({ content }) });
      await Promise.all([qc.invalidateQueries({ queryKey: ["ai", "messages", conv.id] }), qc.invalidateQueries({ queryKey: ["ai", "quota"] })]);
    },
    onError: () => void qc.invalidateQueries({ queryKey: ["ai", "quota"] }), // a refused send may still have changed the count
  });
}

/**
 * Confirms or rejects a proposal (neither costs a message). The card settles as soon as its own thread is fresh; a confirmed task now exists,
 * so everything a new task touches (project lists and dashboard counts, My tasks, an open board) is refreshed in the background.
 */
export function useResolveProposal(conversationId: string | undefined, workspaceId: string | undefined) {
  const qc = useQueryClient();
  const refreshThread = () => qc.invalidateQueries({ queryKey: ["ai", "messages", conversationId] });
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: "confirm" | "reject" }) => api(`/ai/proposals/${id}/${action}`, { method: "POST" }),
    onSuccess: async (_data, { action }) => {
      if (action === "confirm") {
        for (const k of ["projects", "dashboard", "my-tasks"]) void qc.invalidateQueries({ queryKey: [k, workspaceId] });
        void qc.invalidateQueries({ queryKey: ["tasks"] });
        void qc.invalidateQueries({ queryKey: ["project"] });
      }
      await refreshThread(); // the card changes from the refetched thread, so wait for it before the buttons come back
    },
    onError: () => void refreshThread(), // a 409 means the card on screen is stale; the error line must not wait for this
  });
}
