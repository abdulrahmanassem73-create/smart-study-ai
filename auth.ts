/*
Auth (Hybrid)
- الوضع المحلي (Mock) كان موجوداً سابقاً.
- المرحلة 11: دعم Supabase Auth مع fallback تلقائي لو لم يتم ضبط مفاتيح البيئة.

ملاحظة مهمة:
- أغلب واجهات التطبيق تعتمد على getCurrentUser() بشكل متزامن.
- لذلك نقوم بتخزين نسخة مبسطة من المستخدم في localStorage (CURRENT_KEY)
  وتحديثها عبر initAuthListener().
*/

import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import type { User as SupabaseUser } from "@supabase/supabase-js";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  avatarUrl?: string;
};

export const GUEST_USER_ID = "guest";

const USERS_KEY = "aass:users"; // mock users
const CURRENT_KEY = "aass:current_user"; // cached current user (supabase or mock)

// -----------------------------
// Local (Mock) helpers
// -----------------------------
function readUsers(): AuthUser[] {
  const raw = localStorage.getItem(USERS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeUsers(users: AuthUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function cacheCurrentUser(user: AuthUser | null) {
  if (!user) {
    localStorage.removeItem(CURRENT_KEY);
    return;
  }
  localStorage.setItem(CURRENT_KEY, JSON.stringify(user));
}

export function getCurrentUser(): AuthUser | null {
  const raw = localStorage.getItem(CURRENT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

// -----------------------------
// Supabase Auth (primary when configured)
// -----------------------------
function meta(u: SupabaseUser): Record<string, unknown> {
  return (u.user_metadata || {}) as Record<string, unknown>;
}

function pickString(v: unknown, fallback = "") {
  return typeof v === "string" ? v : fallback;
}

export function initAuthListener() {
  const sb = getSupabaseClient();
  if (!sb) return;

  // hydrate once (prefer session then user)
  sb.auth
    .getSession()
    .then(async ({ data }) => {
      const u = data.session?.user || null;
      if (u) return u;
      const res = await sb.auth.getUser();
      return res.data.user || null;
    })
    .then((u) => {
      if (!u) {
        cacheCurrentUser(null);
        return;
      }
      const m = meta(u);
      cacheCurrentUser({
        id: u.id,
        name: pickString(m.name, pickString(m.full_name, "مستخدم")),
        email: u.email || "",
        createdAt: u.created_at || new Date().toISOString(),
        avatarUrl: pickString(m.avatar_url, pickString(m.picture, "")),
      });
    })
    .catch(() => {
      // ignore
    });

  sb.auth.onAuthStateChange((_event, session) => {
    const u = session?.user || null;
    if (!u) {
      cacheCurrentUser(null);
      return;
    }
    const m = meta(u);
    cacheCurrentUser({
      id: u.id,
      name: pickString(m.name, pickString(m.full_name, "مستخدم")),
      email: u.email || "",
      createdAt: u.created_at || new Date().toISOString(),
      avatarUrl: pickString(m.avatar_url, pickString(m.picture, "")),
    });
  });
}

export async function signUp(params: { name: string; email: string; password: string }) {
  const name = params.name.trim();
  const email = params.email.trim().toLowerCase();
  const password = params.password;
  if (!name || !email || !password) throw new Error("INVALID_INPUT");

  const sb = getSupabaseClient();
  if (sb) {
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (error) throw new Error(error.message);

    const u = data.user;
    if (!u) throw new Error("SIGNUP_FAILED");

    const user: AuthUser = {
      id: u.id,
      name,
      email: u.email || email,
      createdAt: u.created_at || new Date().toISOString(),
    };
    cacheCurrentUser(user);
    return user;
  }

  // fallback: mock
  if (readUsers().some((u) => u.email === email)) throw new Error("EMAIL_EXISTS");
  const user: AuthUser = {
    id: `u_${Math.random().toString(16).slice(2)}_${Date.now()}`,
    name,
    email,
    createdAt: new Date().toISOString(),
  };
  const users = readUsers();
  users.unshift(user);
  writeUsers(users);
  cacheCurrentUser(user);
  return user;
}

export async function signIn(params: { email: string; password: string }) {
  const email = params.email.trim().toLowerCase();
  const password = params.password;
  if (!email || !password) throw new Error("INVALID_INPUT");

  const sb = getSupabaseClient();
  if (sb) {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);

    const u = data.user;
    const user: AuthUser = {
      id: u.id,
      name: pickString(meta(u).name, "مستخدم"),
      email: u.email || email,
      createdAt: u.created_at || new Date().toISOString(),
    };
    cacheCurrentUser(user);
    return user;
  }

  // fallback: mock
  const users = readUsers();
  const user = users.find((u) => u.email === email) || null;
  if (!user) throw new Error("NOT_FOUND");
  cacheCurrentUser(user);
  return user;
}

export async function signInWithGoogle() {
  const sb = getSupabaseClient();
  if (!sb) throw new Error("CLOUD_NOT_CONFIGURED");

  // ملاحظة: Google redirect URI الفعلي يكون دائماً:
  // https://hzjvfdphhpqxrnonbltk.supabase.co/auth/v1/callback
  // ويُضبط داخل Google Cloud/Supabase. هنا نحدد فقط صفحة الرجوع داخل موقعنا.
  const { error } = await sb.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/auth`,
    },
  });

  if (error) throw new Error(error.message);
}

export async function signOut() {
  const sb = getSupabaseClient();
  if (sb) {
    await sb.auth.signOut();
  }
  cacheCurrentUser(null);
}

export function cloudAuthEnabled() {
  return isSupabaseConfigured();
}
