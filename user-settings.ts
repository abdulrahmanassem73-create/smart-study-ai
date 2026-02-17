/*
User settings (theme + golden tickets)
Backend: public.user_settings
*/

import { cloudAuthEnabled, getCurrentUser, type AuthUser } from "@/lib/auth";
import { getSupabaseClient } from "@/lib/supabase";

export type UserSettings = {
  user_id: string;
  theme: string;
  golden_tickets: number;
  /** إظهار/إخفاء مساحات الإعلانات */
  ads_enabled?: boolean;
  updated_at?: string;
};

const LS_KEY = (userId: string) => `aass:user_settings:${userId}`;

export function getCachedSettings(userId: string): UserSettings | null {
  const raw = localStorage.getItem(LS_KEY(userId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserSettings;
  } catch {
    return null;
  }
}

function writeCache(userId: string, s: UserSettings) {
  localStorage.setItem(LS_KEY(userId), JSON.stringify(s));
  try {
    window.dispatchEvent(new CustomEvent("aass:settings_updated", { detail: s }));
  } catch {
    // ignore
  }
}

export async function getOrCreateSettings(user: AuthUser): Promise<UserSettings> {
  if (!cloudAuthEnabled()) {
    const local =
      getCachedSettings(user.id) ||
      ({ user_id: user.id, theme: "default", golden_tickets: 0, ads_enabled: true } satisfies UserSettings);
    writeCache(user.id, local);
    return local;
  }

  const sb = getSupabaseClient();
  if (!sb) throw new Error("CLOUD_NOT_CONFIGURED");

  const { data, error } = await sb
    .from("user_settings")
    .select("user_id,theme,golden_tickets,ads_enabled,updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw new Error(error.message);

  if (data) {
    const s: UserSettings = {
      user_id: String((data as any).user_id),
      theme: String((data as any).theme || "default"),
      golden_tickets: Number((data as any).golden_tickets || 0),
      ads_enabled: typeof (data as any).ads_enabled === "boolean" ? (data as any).ads_enabled : true,
      updated_at: (data as any).updated_at,
    };
    writeCache(user.id, s);
    return s;
  }

  const seed: UserSettings = { user_id: user.id, theme: "default", golden_tickets: 0, ads_enabled: true };
  const { error: insErr } = await sb.from("user_settings").insert(seed);
  if (insErr) throw new Error(insErr.message);
  writeCache(user.id, seed);
  return seed;
}

export async function updateSettings(user: AuthUser, patch: Partial<UserSettings>) {
  const prev = getCachedSettings(user.id);

  const next: UserSettings = {
    user_id: user.id,
    theme: String(patch.theme ?? prev?.theme ?? "default"),
    golden_tickets: Number(patch.golden_tickets ?? prev?.golden_tickets ?? 0),
    ads_enabled:
      typeof patch.ads_enabled === "boolean"
        ? patch.ads_enabled
        : typeof prev?.ads_enabled === "boolean"
          ? prev.ads_enabled
          : true,
  };

  writeCache(user.id, next);

  if (!cloudAuthEnabled()) return next;

  const sb = getSupabaseClient();
  if (!sb) return next;

  const { error } = await sb
    .from("user_settings")
    .upsert({
      user_id: user.id,
      theme: next.theme,
      golden_tickets: next.golden_tickets,
      ads_enabled: typeof next.ads_enabled === "boolean" ? next.ads_enabled : true,
      updated_at: new Date().toISOString(),
    });
  if (error) throw new Error(error.message);

  return next;
}

export function getActiveThemeClass(): string {
  const u = getCurrentUser();
  if (!u) return "";
  const s = getCachedSettings(u.id);
  const theme = s?.theme || "default";
  if (theme === "neon") return "theme-neon";
  if (theme === "dark-pro") return "theme-dark-pro";
  return "";
}
