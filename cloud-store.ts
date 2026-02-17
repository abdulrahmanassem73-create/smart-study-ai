/*
Cloud store helpers (Supabase)
- عمليات CRUD الأساسية على files/chats
*/

import { getSupabaseClient } from "@/lib/supabase";
import type { AuthUser } from "@/lib/auth";

export type CloudFileRow = {
  id: string;
  user_id: string;
  name: string;
  content: string;
  summary: string;
  mindmap_code?: string;
  pdf_path?: string;
  file_size_bytes?: number;
  created_at?: string;
};

export type CloudChatRow = {
  id: string;
  file_id: string;
  user_id: string;
  messages: any[];
  updated_at?: string;
};

export async function cloudUpsertFile(user: AuthUser, row: Omit<CloudFileRow, "user_id">) {
  const sb = getSupabaseClient();
  if (!sb) throw new Error("CLOUD_NOT_CONFIGURED");

  const payload: CloudFileRow = { ...row, user_id: user.id };
  const { error } = await sb.from("files").upsert(payload);
  if (error) throw new Error(error.message);
}

export async function cloudListFileIds(user: AuthUser, ids?: string[]) {
  const sb = getSupabaseClient();
  if (!sb) throw new Error("CLOUD_NOT_CONFIGURED");

  let q = sb.from("files").select("id").eq("user_id", user.id);
  if (ids && ids.length) q = q.in("id", ids);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data || []).map((x: any) => String(x.id));
}

export async function cloudFetchFilesForSearch(user: AuthUser, limit = 200) {
  const sb = getSupabaseClient();
  if (!sb) throw new Error("CLOUD_NOT_CONFIGURED");

  const { data, error } = await sb
    .from("files")
    .select("id,name,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  return (data || []).map((x: any) => ({
    id: String(x.id),
    fileName: String(x.name),
    uploadedAt: String(x.created_at || new Date().toISOString()),
  }));
}

export async function cloudFetchSummaries(user: AuthUser, params?: { excludeFileId?: string; maxFiles?: number }) {
  const sb = getSupabaseClient();
  if (!sb) throw new Error("CLOUD_NOT_CONFIGURED");

  const maxFiles = params?.maxFiles ?? 8;
  let q = sb
    .from("files")
    .select("id,name,summary,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(maxFiles + 1);

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  return (data || [])
    .map((x: any) => ({
      fileId: String(x.id),
      fileName: String(x.name),
      summary: String(x.summary || ""),
    }))
    .filter((x: any) => x.fileId !== (params?.excludeFileId || ""))
    .slice(0, maxFiles)
    .filter((x: any) => x.summary.trim().length > 0);
}

export async function cloudSearchInMyFiles(params: { user: AuthUser; q: string; limit?: number }) {
  const sb = getSupabaseClient();
  if (!sb) throw new Error("CLOUD_NOT_CONFIGURED");

  const q = params.q.trim();
  if (!q) return [] as Array<{ fileId: string; fileName: string; snippet: string; rank: number }>;

  const { data, error } = await sb.rpc("search_in_my_files", {
    q,
    limit_n: params.limit ?? 12,
  });

  if (error) throw new Error(error.message);

  return (data || []).map((r: any) => ({
    fileId: String(r.file_id),
    fileName: String(r.file_name),
    snippet: String(r.snippet || ""),
    rank: Number(r.rank || 0),
  }));
}

export async function cloudUpsertChat(params: { user: AuthUser; fileId: string; messages: any[] }) {
  const sb = getSupabaseClient();
  if (!sb) throw new Error("CLOUD_NOT_CONFIGURED");

  const payload = {
    id: `chat_${params.user.id}_${params.fileId}`,
    file_id: params.fileId,
    user_id: params.user.id,
    messages: params.messages,
  };

  const { error } = await sb.from("chats").upsert(payload, {
    onConflict: "file_id,user_id",
  });
  if (error) throw new Error(error.message);
}

export async function cloudGetChat(params: { user: AuthUser; fileId: string }) {
  const sb = getSupabaseClient();
  if (!sb) throw new Error("CLOUD_NOT_CONFIGURED");

  const { data, error } = await sb
    .from("chats")
    .select("messages,updated_at")
    .eq("user_id", params.user.id)
    .eq("file_id", params.fileId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  const msgs = (data as any)?.messages;
  const updatedAt = (data as any)?.updated_at;
  return {
    messages: Array.isArray(msgs) ? msgs : null,
    updatedAt: typeof updatedAt === "string" ? updatedAt : null,
  } as { messages: any[] | null; updatedAt: string | null };
}
