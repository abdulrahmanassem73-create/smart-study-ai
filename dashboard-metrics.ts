/*
Dashboard metrics helpers (localStorage)
*/

import { GUEST_USER_ID } from "@/lib/auth";

export function getEffectiveUserId() {
  try {
    const raw = localStorage.getItem("aass:current_user");
    if (!raw) return GUEST_USER_ID;
    const u = JSON.parse(raw);
    return u?.id || GUEST_USER_ID;
  } catch {
    return GUEST_USER_ID;
  }
}

export function chatCountForUser(userId: string) {
  let count = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    if (k.startsWith(`aass:chat:${userId}:`)) count++;
  }
  return count;
}

export function answeredCountForUser(userId: string) {
  const raw = localStorage.getItem(`aass:quiz_answered:${userId}`);
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) ? n : 0;
}

export function incrementAnsweredCount(userId: string, delta = 1) {
  const next = answeredCountForUser(userId) + delta;
  localStorage.setItem(`aass:quiz_answered:${userId}`, String(next));
  return next;
}

export type RecentFile = {
  id: string;
  fileName: string;
  uploadedAt: string;
  openedAt: string;
};

export function readRecentFiles(userId: string): RecentFile[] {
  const raw = localStorage.getItem(`aass:recent_files:${userId}`);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function pushRecentFile(userId: string, file: Omit<RecentFile, "openedAt">) {
  const list = readRecentFiles(userId);
  const openedAt = new Date().toISOString();
  const next: RecentFile = { ...file, openedAt };
  const merged = [next, ...list.filter((x: any) => x?.id !== file.id)].slice(0, 10);
  localStorage.setItem(`aass:recent_files:${userId}`, JSON.stringify(merged));
  return merged;
}
