"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import type { Workspace } from "./nav";

export type Me = { id: string; email: string; name: string; avatarUrl: string | null };

export const useMe = () => useQuery({ queryKey: ["me"], queryFn: () => api<{ user: Me }>("/auth/me").then((d) => d.user) });

export const useWorkspaces = () => useQuery({ queryKey: ["workspaces"], queryFn: () => api<Workspace[]>("/workspaces") });
