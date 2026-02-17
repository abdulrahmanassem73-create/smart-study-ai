import * as React from "react";
import { Crown, Medal, Trophy } from "lucide-react";

import AppShell from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { cloudAuthEnabled, getCurrentUser } from "@/lib/auth";
import { getSupabaseClient } from "@/lib/supabase";
import { createAvatarSignedUrl } from "@/lib/cloud-storage";

type LeaderRow = {
  user_id: string;
  xp: number;
  current_level: number;
  display_name: string;
  avatar_path: string | null;
};

const glassCard = "dark:bg-white/10 dark:backdrop-blur-md dark:border-white/10";

function rankIcon(rank: number) {
  if (rank === 1) return Crown;
  if (rank === 2) return Trophy;
  if (rank === 3) return Medal;
  return Trophy;
}

export default function LeaderboardPage() {
  const user = getCurrentUser();
  const [rows, setRows] = React.useState<LeaderRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [avatars, setAvatars] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (!cloudAuthEnabled()) return;
    const sb = getSupabaseClient();
    if (!sb) return;

    let alive = true;
    setLoading(true);

    (async () => {
      try {
        // leaderboard_public view: آمنة ومخصصة للعرض العام
        const { data, error } = await sb
          .from("leaderboard_public")
          .select("user_id,xp,current_level,display_name,avatar_path")
          .order("xp", { ascending: false })
          .limit(25);

        if (error) throw error;

        const merged: LeaderRow[] = ((data as any[]) || []).map((r) => ({
          user_id: String((r as any).user_id),
          xp: Number((r as any).xp || 0),
          current_level: Number((r as any).current_level || 1),
          display_name: String((r as any).display_name || ""),
          avatar_path: (r as any).avatar_path ? String((r as any).avatar_path) : null,
        }));

        if (!alive) return;
        setRows(merged);
      } catch {
        if (!alive) return;
        setRows([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [user?.id]);

  React.useEffect(() => {
    // Signed urls for avatars (best-effort)
    if (!user || !cloudAuthEnabled()) return;

    const todo = rows.filter((r) => r.avatar_path && !avatars[r.user_id]);
    if (!todo.length) return;

    (async () => {
      const next: Record<string, string> = {};
      for (const r of todo.slice(0, 10)) {
        try {
          const url = await createAvatarSignedUrl({
            user,
            avatarPath: String(r.avatar_path),
            expiresInSec: 60 * 10,
          });
          next[r.user_id] = url;
        } catch {
          // ignore
        }
      }
      if (Object.keys(next).length) setAvatars((p) => ({ ...p, ...next }));
    })();
  }, [rows, user?.id]);

  return (
    <AppShell>
      <section className="mx-auto w-full max-w-4xl space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl md:text-4xl font-extrabold">لوحة الشرف</h1>
          <p className="text-muted-foreground leading-7">
            ترتيب المستخدمين حسب XP (بيانات سحابية مباشرة).
          </p>
        </div>

        <Card className={cn(glassCard)}>
          <CardHeader className="pb-3">
            <CardTitle className="text-xl">أفضل 25 طالب</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!cloudAuthEnabled() && (
              <div className="text-sm text-muted-foreground">فعّل السحابة أولاً.</div>
            )}

            {cloudAuthEnabled() && loading && (
              <div className="text-sm text-muted-foreground">جاري تحميل الترتيب...</div>
            )}

            {cloudAuthEnabled() && !loading && rows.length === 0 && (
              <div className="text-sm text-muted-foreground">لا توجد بيانات بعد.</div>
            )}

            {rows.map((r, i) => {
              const rank = i + 1;
              const Icon = rankIcon(rank);
              const isMe = user?.id && r.user_id === user.id;
              const label = r.display_name || (isMe ? user?.name : "طالب");
              const avatarUrl = avatars[r.user_id] || (isMe ? user?.avatarUrl : "");

              return (
                <div key={r.user_id} className="rounded-2xl border bg-background/60 dark:bg-white/5 dark:border-white/10">
                  <div className="p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn("size-10 rounded-xl grid place-items-center", isMe ? "bg-primary text-primary-foreground" : "bg-secondary")}
                      >
                        <Icon className="size-5" />
                      </div>

                      <Avatar>
                        <AvatarImage src={avatarUrl} alt={label} />
                        <AvatarFallback>{label.slice(0, 1)}</AvatarFallback>
                      </Avatar>

                      <div className="min-w-0">
                        <div className="font-extrabold truncate">
                          #{rank} — {label}
                          {isMe ? " (أنت)" : ""}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Level {r.current_level} • XP {r.xp}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            <Separator />
            <div className="text-xs text-muted-foreground leading-6">
              ملاحظة: لا يمكن ضمان ظهورك بالمركز الأول إلا إذا كانت XP الخاصة بك فعلاً الأعلى في قاعدة البيانات.
            </div>
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
