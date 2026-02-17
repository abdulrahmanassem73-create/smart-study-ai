import * as React from "react";
import { Award, Clock3, FileCheck2, GraduationCap, TrendingUp } from "lucide-react";

const StatsWeeklyChart = React.lazy(() => import("@/components/charts/StatsWeeklyChart"));
const StatsSubjectsChart = React.lazy(() => import("@/components/charts/StatsSubjectsChart"));
import { LoadingSpinner } from "@/components/LoadingSpinner";
import type { WeeklyRow } from "@/components/charts/StatsWeeklyChart";
import type { SubjectRow } from "@/components/charts/StatsSubjectsChart";

import AppShell from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import AdUnit from "@/components/ads/AdUnit";
import { cn } from "@/lib/utils";
import { cloudAuthEnabled, getCurrentUser } from "@/lib/auth";
import { getSupabaseClient } from "@/lib/supabase";

const glassCard = "dark:bg-white/10 dark:backdrop-blur-md dark:border-white/10";

function formatHours(h: number) {
  return `${h.toFixed(1)} ساعة`;
}

function dayLabelAr(d: Date) {
  // Arabic weekday labels
  const labels = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  return labels[d.getDay()] || "";
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

type RankTier = {
  key: string;
  name: string;
  minXp: number;
  badgeVariant: "default" | "secondary" | "outline" | "destructive";
};

const RANK_TIERS: RankTier[] = [
  { key: "starter", name: "مبتدئ", minXp: 0, badgeVariant: "secondary" },
  { key: "focused", name: "مجتهد", minXp: 500, badgeVariant: "outline" },
  { key: "pro", name: "محترف", minXp: 1500, badgeVariant: "default" },
  { key: "elite", name: "نخبة", minXp: 3500, badgeVariant: "default" },
  { key: "legend", name: "أسطورة", minXp: 7000, badgeVariant: "destructive" },
];

function getRankTier(xp: number) {
  const x = Math.max(0, Number(xp || 0));
  let current = RANK_TIERS[0];
  for (const t of RANK_TIERS) if (x >= t.minXp) current = t;
  const idx = RANK_TIERS.findIndex((t) => t.key === current.key);
  const next = idx >= 0 && idx < RANK_TIERS.length - 1 ? RANK_TIERS[idx + 1] : null;
  const nextXp = next ? next.minXp : null;
  const progress = nextXp ? Math.min(100, Math.max(0, ((x - current.minXp) / Math.max(1, nextXp - current.minXp)) * 100)) : 100;
  return { current, next, nextXp, progress, xp: x };
}

function isoDayKey(d: Date) {
  const x = startOfDay(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function StatsPage() {
  const user = getCurrentUser();
  const cloud = cloudAuthEnabled();

  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string>("");

  const [stats, setStats] = React.useState({
    totalStudyHours30d: 0,
    avgScore10: 0,
    answeredQuestions: 0,
    processedFiles: 0,
    xp: 0,
    level: 1,
    coins: 0,
  });

  const [weekly, setWeekly] = React.useState<WeeklyRow[]>([]);
  const [subjects, setSubjects] = React.useState<SubjectRow[]>([]);
  const [encourage, setEncourage] = React.useState<string>("");

  React.useEffect(() => {
    if (!user || !cloud) {
      setLoading(false);
      return;
    }

    const sb = getSupabaseClient();
    if (!sb) {
      setLoading(false);
      return;
    }

    let alive = true;

    (async () => {
      setLoading(true);
      setErr("");

      try {
        // -------------------------
        // 1) user_stats (xp/level/coins + weak/strong topics if available)
        // -------------------------
        let xp = 0;
        let level = 1;
        let coins = 0;
        let weakTopics: string[] = [];
        let strongTopics: string[] = [];

        try {
          const { data: us, error: ue } = await sb
            .from("user_stats")
            .select("xp,total_xp,current_level,coins,weak_topics,strong_topics")
            .eq("user_id", user.id)
            .maybeSingle();
          if (!ue && us) {
            xp = Number((us as any).xp ?? (us as any).total_xp ?? 0) || 0;
            level = Number((us as any).current_level || 1) || 1;
            coins = Number((us as any).coins || 0) || 0;
            weakTopics = Array.isArray((us as any).weak_topics) ? (us as any).weak_topics.map(String) : [];
            strongTopics = Array.isArray((us as any).strong_topics) ? (us as any).strong_topics.map(String) : [];
          }
        } catch {
          // ignore
        }

        // -------------------------
        // 2) processed files count
        // -------------------------
        const { count: filesCount } = await sb
          .from("files")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id);

        // -------------------------
        // 3) quizzes: answered questions + recent scores
        // -------------------------
        const { data: qz } = await sb
          .from("quizzes")
          .select("score,total,created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50);

        const quizRows = (qz as any[]) || [];
        const answeredQuestions = quizRows.reduce((acc, r) => acc + (Number(r?.total) || 0), 0);

        // -------------------------
        // 4) exam_attempts: average score + weekly time + progress trend
        // -------------------------
        const now = new Date();
        const start30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const start14 = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

        const { data: attempts } = await sb
          .from("exam_attempts")
          .select("created_at,score,total,exam_id")
          .eq("user_id", user.id)
          .gte("created_at", start30.toISOString())
          .order("created_at", { ascending: true })
          .limit(500);

        const attRows = (attempts as any[]) || [];

        // Map exam durations (best effort)
        const examIds = Array.from(new Set(attRows.map((a) => String(a.exam_id || "")).filter(Boolean)));
        const examDurationMap = new Map<string, number>();

        if (examIds.length) {
          const { data: ex } = await sb
            .from("exams")
            .select("id,duration_sec")
            .eq("user_id", user.id)
            .in("id", examIds);
          for (const r of (ex as any[]) || []) {
            examDurationMap.set(String(r.id), Number(r.duration_sec || 0));
          }
        }

        // Weekly (last 7 days) minutes from exam durations
        const last7Days: Date[] = Array.from({ length: 7 }).map((_, i) => {
          const d = new Date(now.getTime() - (6 - i) * 24 * 60 * 60 * 1000);
          return startOfDay(d);
        });

        const minutesByDay = new Map<string, number>(last7Days.map((d) => [isoDayKey(d), 0]));

        for (const a of attRows) {
          const createdAt = a.created_at ? new Date(String(a.created_at)) : null;
          if (!createdAt) continue;
          const key = isoDayKey(createdAt);
          if (!minutesByDay.has(key)) continue; // only last 7
          const durSec = examDurationMap.get(String(a.exam_id || "")) || 0;
          const addMin = durSec ? durSec / 60 : 15; // fallback 15 min per attempt if duration unknown
          minutesByDay.set(key, (minutesByDay.get(key) || 0) + addMin);
        }

        const weeklyData: WeeklyRow[] = last7Days.map((d) => {
          const key = isoDayKey(d);
          const minutes = Math.round(minutesByDay.get(key) || 0);
          return {
            day: dayLabelAr(d),
            minutes,
            hours: Number((minutes / 60).toFixed(2)),
          };
        });

        // 30d total hours
        const totalMinutes30 = attRows.reduce((acc, a) => {
          const durSec = examDurationMap.get(String(a.exam_id || "")) || 0;
          return acc + (durSec ? durSec / 60 : 15);
        }, 0);

        // avg score last 10 attempts (prefer exam_attempts; fallback quizzes)
        const last10 = attRows.slice(-10);
        const avgScore10 = last10.length
          ? Math.round(
              (last10.reduce((acc, a) => {
                const s = Number(a.score || 0);
                const t = Number(a.total || 0) || 1;
                return acc + (s / t) * 100;
              }, 0) /
                last10.length) ||
                0
            )
          : quizRows.length
            ? Math.round(
                (quizRows.slice(0, 10).reduce((acc, r) => {
                  const s = Number(r?.score || 0);
                  const t = Number(r?.total || 0) || 1;
                  return acc + (s / t) * 100;
                }, 0) /
                  Math.min(10, quizRows.length)) ||
                  0
              )
            : 0;

        // Encourage message: compare last 7 vs previous 7
        const att14 = attRows.filter((a) => {
          const c = a.created_at ? new Date(String(a.created_at)) : null;
          return c ? c >= start14 : false;
        });

        const split = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const minsLast7 = att14.reduce((acc, a) => {
          const c = new Date(String(a.created_at));
          const durSec = examDurationMap.get(String(a.exam_id || "")) || 0;
          const m = durSec ? durSec / 60 : 15;
          return c >= split ? acc + m : acc;
        }, 0);

        const minsPrev7 = att14.reduce((acc, a) => {
          const c = new Date(String(a.created_at));
          const durSec = examDurationMap.get(String(a.exam_id || "")) || 0;
          const m = durSec ? durSec / 60 : 15;
          return c < split ? acc + m : acc;
        }, 0);

        let encourageText = "";
        if (minsLast7 >= 120) {
          const pct = minsPrev7 ? Math.round(((minsLast7 - minsPrev7) / Math.max(1, minsPrev7)) * 100) : 100;
          if (minsPrev7 === 0) {
            encourageText = "بداية قوية! واضح إنك نشّطت مذاكرتك خلال آخر 7 أيام. كمل بنفس النسق.";
          } else if (pct >= 15) {
            encourageText = `تقدّم ملحوظ! زودت وقت مذاكرتك خلال آخر 7 أيام بنسبة حوالي ${pct}% عن الأسبوع اللي قبله.`;
          }
        }

        // Subjects chart from weak/strong topics (if available)
        const subjectsData: SubjectRow[] = [];
        const seen = new Set<string>();

        for (const t of strongTopics.slice(0, 6)) {
          const s = String(t).trim();
          if (!s || seen.has(s)) continue;
          seen.add(s);
          subjectsData.push({ subject: s, level: 85 });
        }
        for (const t of weakTopics.slice(0, 6)) {
          const s = String(t).trim();
          if (!s || seen.has(s)) continue;
          seen.add(s);
          subjectsData.push({ subject: s, level: 55 });
        }

        // Fallback if no topics yet
        if (!subjectsData.length) {
          subjectsData.push(
            { subject: "(لا توجد بيانات موضوعات بعد)", level: 0 }
          );
        }

        if (!alive) return;

        setStats({
          totalStudyHours30d: Number((totalMinutes30 / 60).toFixed(1)),
          avgScore10,
          answeredQuestions,
          processedFiles: Number(filesCount || 0),
          xp,
          level,
          coins,
        });
        setWeekly(weeklyData);
        setSubjects(subjectsData);
        setEncourage(encourageText);
      } catch (e: any) {
        if (!alive) return;
        setErr(String(e?.message || "تعذر تحميل الإحصائيات"));
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [user?.id, cloud]);

  return (
    <AppShell>
      <section className="mx-auto w-full max-w-6xl space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl md:text-4xl font-extrabold">الإحصائيات المركزية</h1>
          <p className="text-muted-foreground leading-7">
            لوحة تحكم حقيقية مرتبطة بحسابك على Supabase.
          </p>
        </div>

        {!user && (
          <Card className={cn(glassCard)}>
            <CardContent className="pt-6 space-y-2">
              <div className="font-extrabold">سجّل دخولك أولاً</div>
              <div className="text-sm text-muted-foreground leading-7">
                الإحصائيات تعتمد على بياناتك السحابية.
              </div>
            </CardContent>
          </Card>
        )}

        {user && !cloud && (
          <Card className={cn(glassCard)}>
            <CardContent className="pt-6 space-y-2">
              <div className="font-extrabold">السحابة غير مفعلة</div>
              <div className="text-sm text-muted-foreground leading-7">
                فعّل Supabase (VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY) لعرض إحصائيات حقيقية.
              </div>
            </CardContent>
          </Card>
        )}

        {user && cloud && loading && (
          <Card className={cn(glassCard)}>
            <CardContent className="pt-6">
              <LoadingSpinner label="جاري تحميل الإحصائيات..." />
            </CardContent>
          </Card>
        )}

        {user && cloud && !loading && err && (
          <Card className={cn(glassCard)}>
            <CardContent className="pt-6 space-y-2">
              <div className="font-extrabold">تعذر تحميل الإحصائيات</div>
              <div className="text-sm text-muted-foreground">{err}</div>
            </CardContent>
          </Card>
        )}

        {user && cloud && !loading && !err && (
          <>
            {encourage ? (
              <Card className={cn(glassCard)}>
                <CardContent className="pt-6 flex items-start gap-3">
                  <div className="size-10 rounded-xl bg-secondary grid place-items-center">
                    <TrendingUp className="size-5" />
                  </div>
                  <div>
                    <div className="font-extrabold">أداء ممتاز</div>
                    <div className="text-sm text-muted-foreground leading-7 mt-1">{encourage}</div>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {/* Rank / XP */}
            {(() => {
              const r = getRankTier(stats.xp);
              return (
                <Card className={cn(glassCard)}>
                  <CardContent className="pt-6 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="size-10 rounded-xl bg-secondary grid place-items-center">
                        <Award className="size-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="font-extrabold">رتبتك الحالية</div>
                          <Badge variant={r.current.badgeVariant}>{r.current.name}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground leading-7 mt-1">
                          XP: <span className="font-bold text-foreground">{r.xp}</span>
                          {r.next ? (
                            <>
                              {" "}• التالي: <span className="font-bold text-foreground">{r.next.name}</span> عند {r.next.minXp} XP
                            </>
                          ) : (
                            <>
                              {" "}• وصلت لأعلى رتبة حالياً
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <Progress value={r.progress} />

                    {r.next ? (
                      <div className="text-xs text-muted-foreground">
                        المتبقي: {Math.max(0, r.next.minXp - r.xp)} XP
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })()}

            {/* Ad slot (mid-page) */}
            <AdUnit slot={(import.meta.env.VITE_ADSENSE_SLOT_STATS_MID as string | undefined) || ""} />

            {/* Top stats cards */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card className={cn(glassCard)}>
                <CardHeader className="flex-row items-start justify-between space-y-0 pb-2">
                  <div>
                    <CardTitle className="text-base">إجمالي ساعات المذاكرة</CardTitle>
                    <div className="text-xs text-muted-foreground mt-1">آخر 30 يوم (تقريبي)</div>
                  </div>
                  <div className="size-10 rounded-xl bg-secondary grid place-items-center">
                    <Clock3 className="size-5" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-extrabold">{formatHours(stats.totalStudyHours30d)}</div>
                  <div className="text-xs text-muted-foreground mt-1">من سجلات محاولات الامتحان</div>
                </CardContent>
              </Card>

              <Card className={cn(glassCard)}>
                <CardHeader className="flex-row items-start justify-between space-y-0 pb-2">
                  <div>
                    <CardTitle className="text-base">متوسط الدرجات</CardTitle>
                    <div className="text-xs text-muted-foreground mt-1">آخر 10 محاولات</div>
                  </div>
                  <div className="size-10 rounded-xl bg-secondary grid place-items-center">
                    <GraduationCap className="size-5" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-extrabold">{stats.avgScore10}%</div>
                  <div className="text-xs text-muted-foreground mt-1">من exam_attempts (أو quizzes كبديل)</div>
                </CardContent>
              </Card>

              <Card className={cn(glassCard)}>
                <CardHeader className="flex-row items-start justify-between space-y-0 pb-2">
                  <div>
                    <CardTitle className="text-base">عدد الأسئلة المُجابة</CardTitle>
                    <div className="text-xs text-muted-foreground mt-1">إجمالي (quizzes)</div>
                  </div>
                  <div className="size-10 rounded-xl bg-secondary grid place-items-center">
                    <FileCheck2 className="size-5" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-extrabold">{stats.answeredQuestions}</div>
                  <div className="text-xs text-muted-foreground mt-1">ملفات: {stats.processedFiles} • Level: {stats.level} • XP: {stats.xp} • Coins: {stats.coins}</div>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <div className="grid gap-5 lg:grid-cols-2">
              <Card className={cn(glassCard)}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">نشاط المذاكرة الأسبوعي</CardTitle>
                  <div className="text-xs text-muted-foreground mt-1">من مدة الامتحانات (أو تقدير 15 دقيقة لكل محاولة)</div>
                </CardHeader>
                <CardContent>
                  <React.Suspense
                    fallback={
                      <div className="h-72 grid place-items-center">
                        <LoadingSpinner label="جاري تحميل الرسم..." />
                      </div>
                    }
                  >
                    <StatsWeeklyChart weekly={weekly} />
                  </React.Suspense>
                </CardContent>
              </Card>

              <Card className={cn(glassCard)}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">نقاط القوة/الضعف حسب الموضوع</CardTitle>
                  <div className="text-xs text-muted-foreground mt-1">من user_stats (weak_topics/strong_topics)</div>
                </CardHeader>
                <CardContent>
                  <React.Suspense
                    fallback={
                      <div className="h-72 grid place-items-center">
                        <LoadingSpinner label="جاري تحميل الرسم..." />
                      </div>
                    }
                  >
                    <StatsSubjectsChart subjects={subjects} />
                  </React.Suspense>
                </CardContent>
              </Card>
            </div>

            {/* Ad slot (bottom) */}
            <AdUnit slot={(import.meta.env.VITE_ADSENSE_SLOT_STATS_BOTTOM as string | undefined) || ""} />
          </>
        )}
      </section>
    </AppShell>
  );
}
