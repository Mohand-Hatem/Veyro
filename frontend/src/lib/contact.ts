"use client";

import { useMutation } from "@tanstack/react-query";
import { api } from "./api";

// POST /contact (CS-10, ADR-017): public on purpose, so the form works for people who cannot sign in. 201 { received: true }, 429 CONTACT_RATE_LIMITED.
export const TOPICS = ["QUESTION", "PROBLEM", "BILLING", "FEEDBACK", "OTHER"] as const;
export type Topic = (typeof TOPICS)[number];
export type ContactBody = { name: string; email: string; topic: Topic; message: string; website: string };

export const useSendContact = () =>
  useMutation({ mutationFn: (b: ContactBody) => api<{ received: boolean }>("/contact", { method: "POST", body: JSON.stringify(b) }) });

/** The checks the server makes (name 2 to 100, an email, message 10 to 2000), so most mistakes never leave the browser. */
export function contactErrors(v: { name: string; email: string; message: string }) {
  const errs: { name?: true; email?: true; message?: true } = {};
  if (v.name.trim().length < 2 || v.name.trim().length > 100) errs.name = true;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email.trim())) errs.email = true;
  if (v.message.trim().length < 10 || v.message.length > 2000) errs.message = true;
  return errs;
}
