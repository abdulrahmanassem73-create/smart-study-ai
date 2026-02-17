/*
Supabase client (Cloud-Native layer)
- يعتمد على متغيرات البيئة في Vite فقط:
  - import.meta.env.VITE_SUPABASE_URL
  - import.meta.env.VITE_SUPABASE_ANON_KEY
- لو المتغيرات غير موجودة: نرجع null (Fallback للوضع المحلي)
- في وضع التطوير فقط: نطبع Console Error مرة واحدة للتنبيه
*/

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _warnedMissingEnv = false;

export function isSupabaseConfigured() {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

  const ok = Boolean(url && key);

  // تحذير يظهر فقط في التطوير لتفادي إزعاج الإنتاج
  if (!ok && import.meta.env.DEV && !_warnedMissingEnv) {
    _warnedMissingEnv = true;
    console.error(
      "[Supabase] Missing env vars. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (Vercel: Project Settings → Environment Variables)."
    );
  }

  return ok;
}

let _client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (_client) return _client;

  const url = import.meta.env.VITE_SUPABASE_URL as string;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

  _client = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: "aass:supabase:auth",
    },
  });

  return _client;
}

export async function checkSupabaseConnection() {
  const sb = getSupabaseClient();
  if (!sb) return { ok: false, error: "CLOUD_NOT_CONFIGURED" };

  try {
    const { error } = await sb.from("files").select("id").limit(1);

    if (!error) return { ok: true, error: null as any };

    const msg = String((error as any).message || "");
    if (
      msg.toLowerCase().includes("jwt") ||
      msg.toLowerCase().includes("permission") ||
      msg.toLowerCase().includes("not allowed") ||
      msg.toLowerCase().includes("row level")
    ) {
      return { ok: true, error: "AUTH_REQUIRED" };
    }

    return { ok: false, error: msg || "UNKNOWN" };
  } catch (e: any) {
    return { ok: false, error: e?.message || "NETWORK_ERROR" };
  }
}
