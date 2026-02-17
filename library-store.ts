/*
Library store (Cloud-first)
- المصدر الأساسي: Supabase (public.files)
- localStorage لم يعد مصدر الحقيقة؛ نستخدمه فقط كـ cache بسيط عند الحاجة.
*/

import type { GeminiExplainResult } from "@/lib/gemini-service";
import type { AuthUser } from "@/lib/auth";
import { cloudAuthEnabled } from "@/lib/auth";
import { getSupabaseClient } from "@/lib/supabase";

export type LibraryItem = {
  id: string;
  userId: string;
  fileName: string;
  uploadedAt: string;
  extractedChars?: number;
  hasAnalysis: boolean;
};

const LIB_KEY = (userId: string) => `aass:library:${userId}`;
const ANALYSIS_KEY = (userId: string, fileId: string) => `aass:analysis:${userId}:${fileId}`;
const EXTRACT_SUMMARY_KEY = (userId: string, fileId: string) =>
  `aass:extract_summary:${userId}:${fileId}`;

export function readLibrary(userId: string): LibraryItem[] {
  const raw = localStorage.getItem(LIB_KEY(userId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeLibrary(userId: string, items: LibraryItem[]) {
  localStorage.setItem(LIB_KEY(userId), JSON.stringify(items));
}

export function upsertLibraryItem(user: AuthUser, item: Omit<LibraryItem, "userId">) {
  const list = readLibrary(user.id);
  const next: LibraryItem = { ...item, userId: user.id };
  const merged = [next, ...list.filter((x) => x.id !== next.id)];
  writeLibrary(user.id, merged);
  return merged;
}

// Local cache helpers (non-authoritative)
export function saveExtractSummary(user: AuthUser, fileId: string, summary: string) {
  localStorage.setItem(EXTRACT_SUMMARY_KEY(user.id, fileId), summary);
}

export function readExtractSummary(user: AuthUser, fileId: string) {
  return localStorage.getItem(EXTRACT_SUMMARY_KEY(user.id, fileId)) || "";
}

// Cloud-first: summaries come from files.summary (use when cloud enabled)
export async function fetchExtractSummaryCloud(user: AuthUser, fileId: string) {
  if (!cloudAuthEnabled()) return "";
  const sb = getSupabaseClient();
  if (!sb) return "";

  const { data, error } = await sb
    .from("files")
    .select("summary")
    .eq("user_id", user.id)
    .eq("id", fileId)
    .maybeSingle();

  if (error) return "";
  return String((data as any)?.summary || "");
}

export function getGlobalContextSummaries(params: {
  user: AuthUser;
  excludeFileId?: string;
  perFileChars?: number;
  maxFiles?: number;
}) {
  const perFileChars = params.perFileChars ?? 1500;
  const maxFiles = params.maxFiles ?? 8;
  const list = readLibrary(params.user.id)
    .filter((x) => x.id !== (params.excludeFileId || ""))
    .slice(0, maxFiles);

  return list
    .map((it) => {
      const raw = readExtractSummary(params.user, it.id);
      const summary = raw.slice(0, perFileChars);
      return {
        fileId: it.id,
        fileName: it.fileName,
        summary,
      };
    })
    .filter((x) => x.summary.trim().length > 0);
}

// Cloud-first: save analysis into public.files columns
export async function saveAnalysisCloud(user: AuthUser, fileId: string, result: GeminiExplainResult) {
  // also keep local cache for fast reload
  localStorage.setItem(ANALYSIS_KEY(user.id, fileId), JSON.stringify(result));

  if (!cloudAuthEnabled()) return;
  const sb = getSupabaseClient();
  if (!sb) return;

  await sb
    .from("files")
    .update({
      analysis_markdown: result.markdown,
      analysis_questions: result.questions as any,
    })
    .eq("user_id", user.id)
    .eq("id", fileId);
}

export async function fetchAnalysisCloud(user: AuthUser, fileId: string): Promise<GeminiExplainResult | null> {
  if (!cloudAuthEnabled()) return null;
  const sb = getSupabaseClient();
  if (!sb) return null;

  const { data, error } = await sb
    .from("files")
    .select("analysis_markdown,analysis_questions")
    .eq("user_id", user.id)
    .eq("id", fileId)
    .maybeSingle();

  if (error) return null;

  const md = String((data as any)?.analysis_markdown || "").trim();
  const qs = (data as any)?.analysis_questions;
  if (!md) return null;

  const result: GeminiExplainResult = {
    markdown: md,
    questions: Array.isArray(qs) ? qs : [],
  };

  // refresh local cache
  localStorage.setItem(ANALYSIS_KEY(user.id, fileId), JSON.stringify(result));
  return result;
}

// Backward-compatible local cache readers
export function saveAnalysis(user: AuthUser, fileId: string, result: GeminiExplainResult) {
  localStorage.setItem(ANALYSIS_KEY(user.id, fileId), JSON.stringify(result));
}

export function readAnalysis(user: AuthUser, fileId: string): GeminiExplainResult | null {
  const raw = localStorage.getItem(ANALYSIS_KEY(user.id, fileId));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
