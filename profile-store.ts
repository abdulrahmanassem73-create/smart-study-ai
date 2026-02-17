/*
Profiles store (Supabase + local cache)
- جدول: public.profiles
- Cache: localStorage لتحديث فوري للهيدر والداشبورد
*/

import type { AuthUser } from "@/lib/auth";
import { getSupabaseClient } from "@/lib/supabase";
import { cloudAuthEnabled } from "@/lib/auth";

export type ProfileRow = {
  user_id: string;
  display_name: string;
  study_title: string;
  avatar_path: string;
  created_at?: string;
  updated_at?: string;
};

const LS_KEY = (userId: string) => `aass:profile:${userId}`;

export function getCachedProfile(userId: string): ProfileRow | null {
  const raw = localStorage.getItem(LS_KEY(userId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ProfileRow;
  } catch {
    return null;
  }
}

export function cacheProfile(p: ProfileRow) {
  localStorage.setItem(LS_KEY(p.user_id), JSON.stringify(p));
}

export async function getOrCreateProfile(user: AuthUser): Promise<ProfileRow> {
  const cached = getCachedProfile(user.id);
  if (cached) return cached;

  // fallback local-only
  if (!cloudAuthEnabled()) {
    const p: ProfileRow = {
      user_id: user.id,
      display_name: user.name || "مستخدم",
      study_title: "",
      avatar_path: "",
    };
    cacheProfile(p);
    return p;
  }

  const sb = getSupabaseClient();
  if (!sb) {
    const p: ProfileRow = {
      user_id: user.id,
      display_name: user.name || "مستخدم",
      study_title: "",
      avatar_path: "",
    };
    cacheProfile(p);
    return p;
  }

  const { data, error } = await sb
    .from("profiles")
    .select("user_id,display_name,study_title,avatar_path,created_at,updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw new Error(error.message);

  if (data) {
    const p: ProfileRow = {
      user_id: String((data as any).user_id),
      display_name: String((data as any).display_name || user.name || "مستخدم"),
      study_title: String((data as any).study_title || ""),
      avatar_path: String((data as any).avatar_path || ""),
      created_at: (data as any).created_at,
      updated_at: (data as any).updated_at,
    };
    cacheProfile(p);
    return p;
  }

  const seed: ProfileRow = {
    user_id: user.id,
    display_name: user.name || "مستخدم",
    study_title: "",
    avatar_path: "",
  };

  const { error: insErr } = await sb.from("profiles").insert(seed);
  if (insErr) throw new Error(insErr.message);

  cacheProfile(seed);
  return seed;
}

export async function updateProfile(user: AuthUser, patch: Partial<ProfileRow>) {
  const current = await getOrCreateProfile(user);
  const next: ProfileRow = {
    user_id: user.id,
    display_name: patch.display_name ?? current.display_name,
    study_title: patch.study_title ?? current.study_title,
    avatar_path: patch.avatar_path ?? current.avatar_path,
  };

  cacheProfile(next);

  if (!cloudAuthEnabled()) return next;

  const sb = getSupabaseClient();
  if (!sb) return next;

  const { error } = await sb.from("profiles").upsert(next, { onConflict: "user_id" });
  if (error) throw new Error(error.message);

  return next;
}
