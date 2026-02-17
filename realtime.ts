/*
Realtime subscriptions (Supabase)
- Chats: subscribe per (user_id, file_id)
- Notifications: subscribe per user_id

ملاحظة: نعتمد على Realtime Postgres Changes.
*/

import type { RealtimeChannel } from "@supabase/supabase-js";

import type { AuthUser } from "@/lib/auth";
import { getSupabaseClient } from "@/lib/supabase";
import { setSyncSnapshot } from "@/lib/sync-state";

export type ChatRowPayload = {
  id: string;
  user_id: string;
  file_id: string;
  messages: any[];
  updated_at?: string;
};

export type NotificationRow = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at?: string;
};

export type UserStatsRowPayload = {
  user_id: string;
  /** XP الحقيقي (للتوافق مع UserStats) */
  xp: number;
  /** للتوافق */
  total_xp: number;
  current_level: number;
  streak_count: number;
  last_active: string | null;
  coins: number;
};

export function subscribeToChatRealtime(params: {
  user: AuthUser;
  fileId: string;
  onUpsert: (row: ChatRowPayload) => void;
}) {
  const sb = getSupabaseClient();
  if (!sb) return null;

  const channel: RealtimeChannel = sb.channel(`aass:chat:${params.user.id}:${params.fileId}`);

  channel.on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "chats",
      filter: `user_id=eq.${params.user.id},file_id=eq.${params.fileId}`,
    },
    (payload: any) => {
      const row = (payload.new || payload.record || null) as any;
      if (!row) return;
      params.onUpsert({
        id: String(row.id),
        user_id: String(row.user_id),
        file_id: String(row.file_id),
        messages: Array.isArray(row.messages) ? row.messages : [],
        updated_at: row.updated_at,
      });
    }
  );

  channel.subscribe((status) => {
    if (status === "SUBSCRIBED") {
      setSyncSnapshot({ status: "live", label: "Live", live: true });
    } else if (status === "CHANNEL_ERROR") {
      setSyncSnapshot({ status: "error", label: "Realtime error", live: false });
    }
  });

  return channel;
}

export function subscribeToUserStatsRealtime(params: {
  user: AuthUser;
  onUpsert: (row: UserStatsRowPayload) => void;
}) {
  const sb = getSupabaseClient();
  if (!sb) return null;

  const channel: RealtimeChannel = sb.channel(`aass:stats:${params.user.id}`);

  channel.on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "user_stats",
      filter: `user_id=eq.${params.user.id}`,
    },
    (payload: any) => {
      const row = (payload.new || payload.record || null) as any;
      if (!row) return;
      const xp = Number(row.xp ?? row.total_xp ?? 0);
      params.onUpsert({
        user_id: String(row.user_id),
        xp,
        total_xp: xp,
        current_level: Number(row.current_level || row.study_level || 1),
        streak_count: Number(row.streak_count || 0),
        last_active: row.last_active ? String(row.last_active) : null,
        coins: Number(row.coins || 0),
      } as any);
    }
  );

  channel.subscribe((status) => {
    if (status === "SUBSCRIBED") {
      setSyncSnapshot({ status: "live", label: "Live", live: true });
    }
  });

  return channel;
}

export function subscribeToNotificationsRealtime(params: {
  user: AuthUser;
  onInsertOrUpdate: (row: NotificationRow) => void;
}) {
  const sb = getSupabaseClient();
  if (!sb) return null;

  const channel: RealtimeChannel = sb.channel(`aass:notif:${params.user.id}`);

  channel.on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "notifications",
      filter: `user_id=eq.${params.user.id}`,
    },
    (payload: any) => {
      const row = (payload.new || payload.record || null) as any;
      if (!row) return;
      params.onInsertOrUpdate({
        id: String(row.id),
        user_id: String(row.user_id),
        title: String(row.title || ""),
        message: String(row.message || ""),
        type: String(row.type || "info"),
        is_read: Boolean(row.is_read),
        created_at: row.created_at,
      });
    }
  );

  channel.subscribe((status) => {
    if (status === "SUBSCRIBED") {
      // لا نغير label هنا لو شغال بالفعل، لكن نرفع live flag
      setSyncSnapshot({ status: "live", label: "Live", live: true });
    }
  });

  return channel;
}

export function unsubscribeChannel(channel: RealtimeChannel | null) {
  const sb = getSupabaseClient();
  if (!sb || !channel) return;
  sb.removeChannel(channel);
}
