/*
Gamification stats (Supabase + local fallback)

Backend table: public.user_stats
- user_id (PK)
- total_xp
- current_level
- streak_count
- last_active (timestamptz)

ملاحظات:
- لو Supabase غير مفعّل: نستخدم localStorage.
- Level formula: كل 250 XP = Level.
- Streak: يزيد لو آخر نشاط كان أمس (حسب تاريخ القاهرة/المتصفح).
- Daily first upload XP: +20 مرة واحدة يومياً.
*/

import { cloudAuthEnabled, getCurrentUser, type AuthUser } from "@/lib/auth";
import { getSupabaseClient } from "@/lib/supabase";

export type UserStats = {
  user_id: string;
  /** XP الحقيقي (مطلوب كعمود xp في Supabase) */
  xp: number;
  /** للتوافق مع أجزاء UI القديمة */
  total_xp: number;
  current_level: number;
  streak_count: number;
  last_active: string | null;
  coins: number;
};

const LS_KEY = (userId: string) => `aass:user_stats:${userId}`;
// (Legacy) كان يُستخدم لحد يومي؛ حالياً غير مستخدم.
// const LS_LAST_UPLOAD_DAY = (userId: string) => `aass:last_upload_day:${userId}`;

export function calcLevel(totalXp: number) {
  return Math.max(1, Math.floor(totalXp / 250) + 1);
}

export function levelTitle(level: number) {
  if (level <= 1) return "Beginner";
  if (level <= 3) return "Learner";
  if (level <= 6) return "Advanced";
  return "Elite";
}

export function levelProgress(totalXp: number) {
  const into = totalXp % 250;
  return { into, needed: 250, pct: Math.round((into / 250) * 100) };
}

function dateKey(d = new Date()) {
  // yyyy-mm-dd (local)
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function readLocalStats(userId: string): UserStats {
  const raw = localStorage.getItem(LS_KEY(userId));
  if (raw) {
    try {
      const j = JSON.parse(raw);
      if (j && typeof j === "object") {
        const xp = Number((j as any).xp ?? (j as any).total_xp ?? 0);
        return {
          user_id: userId,
          xp,
          total_xp: xp,
          current_level: Number((j as any).current_level || (j as any).study_level || 1),
          streak_count: Number((j as any).streak_count || 0),
          last_active: (j as any).last_active ? String((j as any).last_active) : null,
          coins: Number((j as any).coins || 0),
        };
      }
    } catch {
      // ignore
    }
  }
  return {
    user_id: userId,
    xp: 0,
    total_xp: 0,
    current_level: 1,
    streak_count: 0,
    last_active: null,
    coins: 0,
  };
}

function writeLocalStats(stats: UserStats) {
  localStorage.setItem(LS_KEY(stats.user_id), JSON.stringify(stats));
  try {
    window.dispatchEvent(new CustomEvent("aass:stats_updated", { detail: stats }));
  } catch {
    // ignore
  }
}

export async function getOrCreateStats(user: AuthUser): Promise<UserStats> {
  if (!cloudAuthEnabled()) {
    const s = readLocalStats(user.id);
    writeLocalStats(s);
    return s;
  }

  const sb = getSupabaseClient();
  if (!sb) return readLocalStats(user.id);

  const { data, error } = await sb
    .from("user_stats")
    .select("user_id,xp,total_xp,current_level,streak_count,last_active,coins")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw new Error(error.message);

  if (data) {
    const xp = Number((data as any).xp ?? (data as any).total_xp ?? 0);
    const s: UserStats = {
      user_id: String((data as any).user_id),
      xp,
      total_xp: xp,
      current_level: Number((data as any).current_level || 1),
      streak_count: Number((data as any).streak_count || 0),
      last_active: (data as any).last_active ? String((data as any).last_active) : null,
      coins: Number((data as any).coins || 0),
    };
    writeLocalStats(s);
    return s;
  }

  const seed: UserStats = {
    user_id: user.id,
    xp: 0,
    total_xp: 0,
    current_level: 1,
    streak_count: 0,
    last_active: null,
    // هدية ترحيبية للمستخدم الجديد
    coins: 1000,
  };

  const { error: insErr } = await sb.from("user_stats").insert(seed);
  if (insErr) throw new Error(insErr.message);

  writeLocalStats(seed);
  return seed;
}

function computeNextStreak(before: UserStats, now = new Date()) {
  const today = dateKey(now);
  const yesterday = dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));

  const last = before.last_active ? dateKey(new Date(before.last_active)) : null;

  if (!last) return 1;
  if (last === today) return before.streak_count || 1;
  if (last === yesterday) return (before.streak_count || 0) + 1;
  return 1;
}

export async function awardXp(params: {
  user: AuthUser;
  xp: number;
  coinsDelta?: number;
  reason: "upload" | "chat" | "quiz";
  markActive?: boolean;
}) {
  const xp = Math.max(0, Math.floor(params.xp));
  if (!xp) return { gained: 0, leveledUp: false, next: null as UserStats | null };

  const before = await getOrCreateStats(params.user);

  const nextXp = before.xp + xp;
  const nextLevel = calcLevel(nextXp);
  const leveledUp = nextLevel > before.current_level;
  const coinsDelta = (params.coinsDelta ? Math.floor(params.coinsDelta) : 0) + (leveledUp ? 10 : 0);

  const nowIso = new Date().toISOString();

  const next: UserStats = {
    user_id: params.user.id,
    xp: nextXp,
    total_xp: nextXp,
    current_level: nextLevel,
    streak_count: params.markActive ? computeNextStreak(before) : before.streak_count,
    last_active: params.markActive ? nowIso : before.last_active,
    coins: before.coins + coinsDelta,
  };

  writeLocalStats(next);

  if (cloudAuthEnabled()) {
    const sb = getSupabaseClient();
    if (sb) {
      const { error } = await sb
        .from("user_stats")
        .upsert(
          {
            ...next,
            // حافظ على توافق الأعمدة القديمة (لو في أي Views/UI قديمة)
            total_xp: next.xp,
          } as any,
          { onConflict: "user_id" }
        );
      if (error) throw new Error(error.message);

      // Smart Notifications (cloud)
      try {
        if (coinsDelta !== 0) {
          await sb.from("notifications").insert({
            id: `n_coins_${Date.now()}_${Math.random().toString(16).slice(2)}`,
            user_id: params.user.id,
            title: "تحديث الرصيد",
            message: coinsDelta > 0 ? `+${coinsDelta} Coins` : `${coinsDelta} Coins`,
            type: coinsDelta > 0 ? "success" : "info",
            is_read: false,
          });
        }
        if (leveledUp) {
          await sb.from("notifications").insert({
            id: `n_level_${Date.now()}_${Math.random().toString(16).slice(2)}`,
            user_id: params.user.id,
            title: "Level Up!",
            message: `وصلت للمستوى ${nextLevel} (${levelTitle(nextLevel)})`,
            type: "success",
            is_read: false,
          });
        }
      } catch {
        // ignore
      }
    }
  }

  return { gained: xp, leveledUp, next };
}

// Upgrade: XP لكل عملية رفع ملف (بدون حد يومي)
export async function awardUploadXpEveryTime(user: AuthUser) {
  return awardXp({ user, xp: 20, reason: "upload", markActive: true });
}

export function getCachedStatsForHeader() {
  const u = getCurrentUser();
  if (!u) return null;

  // Prefer in-memory/latest cache if present (set by realtime in TopNav)
  const raw = localStorage.getItem(LS_KEY(u.id));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserStats;
  } catch {
    return null;
  }
}
