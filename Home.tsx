import * as React from "react";

import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Brain,
  CloudUpload,
  Library,
  Sparkles,
  CheckCircle2,
  FileText,
  Timer,
  Coins,
} from "lucide-react";

import { getCachedStatsForHeader } from "@/lib/user-stats";
import { cloudAuthEnabled, getCurrentUser } from "@/lib/auth";
import { getSupabaseClient } from "@/lib/supabase";


export default function Home() {
  const userRaw = localStorage.getItem("aass:current_user");
  const user = userRaw
    ? (() => {
        try {
          return JSON.parse(userRaw);
        } catch {
          return null;
        }
      })()
    : null;

  // Dashboard metrics (real from storage)
  const userId = user?.id || "guest";
  const libraryRaw = user ? localStorage.getItem(`aass:library:${userId}`) : null;
  const libraryCount = libraryRaw ? (() => { try { const a = JSON.parse(libraryRaw); return Array.isArray(a) ? a.length : 0; } catch { return 0; } })() : 0;

  const chatCount = (() => {
    let c = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(`aass:chat:${userId}:`)) c++;
    }
    return c;
  })();

  const answeredCount = (() => {
    const raw = localStorage.getItem(`aass:quiz_answered:${userId}`);
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) ? n : 0;
  })();

  const recent = (() => {
    const raw = localStorage.getItem(`aass:recent_files:${userId}`);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.slice(0, 2) : [];
    } catch {
      return [];
    }
  })();

  const [stats, setStats] = React.useState(() => getCachedStatsForHeader());

  // Smart review suggestions (cloud-first)
  const [reviewItems, setReviewItems] = React.useState<
    Array<{ fileId: string; fileName: string; topic: string; hint: string }>
  >([]);

  React.useEffect(() => {
    const u = getCurrentUser();
    const sb = getSupabaseClient();
    if (!u || !cloudAuthEnabled() || !sb) {
      setReviewItems([]);
      return;
    }

    (async () => {
      try {
        // 1) latest attempt
        const { data: att, error: ae } = await sb
          .from("exam_attempts")
          .select("exam_id,created_at,weak_topics,wrong_items_json")
          .eq("user_id", u.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (ae) throw ae;
        if (!att) {
          setReviewItems([]);
          return;
        }

        const examId = String((att as any).exam_id || "");
        if (!examId) {
          setReviewItems([]);
          return;
        }

        // 2) find fileId from exam
        const { data: ex, error: ee } = await sb
          .from("exams")
          .select("file_id")
          .eq("user_id", u.id)
          .eq("id", examId)
          .maybeSingle();
        if (ee) throw ee;
        const fileId = String((ex as any)?.file_id || "");
        if (!fileId) {
          setReviewItems([]);
          return;
        }

        // 3) file name
        const { data: f, error: fe } = await sb
          .from("files")
          .select("name")
          .eq("user_id", u.id)
          .eq("id", fileId)
          .maybeSingle();
        if (fe) throw fe;
        const fileName = String((f as any)?.name || "ملف");

        const weakTopics: string[] = Array.isArray((att as any)?.weak_topics)
          ? (att as any).weak_topics.map(String)
          : [];

        const wrongItems: any[] = Array.isArray((att as any)?.wrong_items_json)
          ? (att as any).wrong_items_json
          : [];

        const topics = weakTopics.length
          ? weakTopics
          : Array.from(
              new Set(
                wrongItems
                  .map((w: any) => String(w?.topic || "").trim())
                  .filter((x: string) => x.length)
              )
            ).slice(0, 6);

        setReviewItems(
          topics.slice(0, 3).map((t) => ({
            fileId,
            fileName,
            topic: t,
            hint: `بناءً على امتحانك الأخير، ننصحك بمراجعة فصل (${t}) مرة أخرى.`,
          }))
        );
      } catch (e) {
        console.error(e);
        setReviewItems([]);
      }
    })();
  }, [user?.id]);

  React.useEffect(() => {
    const onStats = (e: any) => setStats(e?.detail || getCachedStatsForHeader());
    window.addEventListener("aass:stats_updated", onStats as any);
    return () => window.removeEventListener("aass:stats_updated", onStats as any);
  }, []);

  const coins = Math.max(0, Number((stats as any)?.coins || 0));
  const xp = Math.max(0, Number((stats as any)?.xp ?? (stats as any)?.total_xp ?? 0));



  return (
    
    
    
    
    
    <AppShell>
      <section className="space-y-6">
        {/* Hero */}
        <Card className="overflow-hidden border bg-background">
          <CardContent className="relative p-6 md:p-10">
            {/* subtle brand wash */}
            <div
              className="pointer-events-none absolute inset-0 opacity-60 dark:opacity-70"
              style={{
                background:
                  "radial-gradient(900px 300px at 10% 10%, color-mix(in oklch, var(--primary) 22%, transparent) 0%, transparent 55%), radial-gradient(900px 300px at 90% 30%, color-mix(in oklch, var(--primary) 14%, transparent) 0%, transparent 55%)",
              }}
            />

            <div className="relative">
              <div className="inline-flex items-center gap-2 rounded-full border bg-secondary/30 px-3 py-1 text-xs font-bold">
                <Sparkles className="size-4" />
                {user ? `أهلاً يا ${user.name} 👋، مستعد نكمل مذاكرة؟` : "مستقبلك الدراسي يبدأ هنا"}
              </div>

              <h1 className="mt-4 text-4xl md:text-5xl font-extrabold leading-tight">
                مستقبلك الدراسي يبدأ هنا
              </h1>

              <p className="mt-3 max-w-2xl text-muted-foreground leading-7">
                ارفع ملفات محاضراتك، دع الذكاء الاصطناعي يحولها لشرح منظم، ثم اختبر نفسك
                بتقييم ذكي يوضح نقاط القوة والضعف.
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-2">
                <Button
                  size="lg"
                  className="gap-2 text-base px-7"
                  onClick={() => (window.location.hash = user ? "#/رفع-المادة" : "#/auth")}
                >
                  <CloudUpload className="size-5" />
                  ابدأ الآن
                  <ArrowLeft className="size-4" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="gap-2 text-base px-7"
                  onClick={() => (window.location.hash = user ? "#/مكتبتي" : "#/auth")}
                >
                  <Library className="size-5" />
                  مكتبتي
                </Button>
              </div>

              {/* Stats Overlay */}
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <Card className="border bg-background/70 dark:bg-white/10 dark:backdrop-blur-md dark:border-white/10">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <div className="text-xs text-muted-foreground">ملفات المكتبة</div>
                      <div className="text-2xl font-extrabold mt-1">{libraryCount}</div>
                    </div>
                    <FileText className="size-5 text-muted-foreground" />
                  </CardContent>
                </Card>

                <Card className="border bg-background/70 dark:bg-white/10 dark:backdrop-blur-md dark:border-white/10">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <div className="text-xs text-muted-foreground">محادثات محفوظة</div>
                      <div className="text-2xl font-extrabold mt-1">{chatCount}</div>
                    </div>
                    <Sparkles className="size-5 text-muted-foreground" />
                  </CardContent>
                </Card>

                <Card className="border bg-background/70 dark:bg-white/10 dark:backdrop-blur-md dark:border-white/10">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <div className="text-xs text-muted-foreground">أسئلة أُجيب عنها</div>
                      <div className="text-2xl font-extrabold mt-1">{answeredCount}</div>
                    </div>
                    <CheckCircle2 className="size-5 text-muted-foreground" />
                  </CardContent>
                </Card>
              </div>

              <Separator className="my-7" />

              {/* Steps */}
              <div className="grid gap-4 md:grid-cols-3">
                <Card className="border bg-background/70 dark:bg-white/10 dark:backdrop-blur-md dark:border-white/10">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <CloudUpload className="size-5" />
                      1) ارفع
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground leading-7">
                    PDF أو صور ملاحظاتك. النظام يستخرج النص الحقيقي ويجهزه للتحليل.
                  </CardContent>
                </Card>

                <Card className="border bg-background/70 dark:bg-white/10 dark:backdrop-blur-md dark:border-white/10">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Brain className="size-5" />
                      2) افهم
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground leading-7">
                    شرح Markdown منسق يدعم الجداول وLaTeX وأكواد البرمجة.
                  </CardContent>
                </Card>

                <Card className="border bg-background/70 dark:bg-white/10 dark:backdrop-blur-md dark:border-white/10">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <CheckCircle2 className="size-5" />
                      3) اختبر
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground leading-7">
                    بنك أسئلة تفاعلي مع تفسير فوري ولوحة نتائج ورسوم بيانية.
                  </CardContent>
                </Card>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Smart Review Plan */}
        <Card className="border bg-background/70 dark:bg-white/10 dark:backdrop-blur-md dark:border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl flex items-center gap-2">
              <Timer className="size-5" />
              خطة المراجعة المقترحة
            </CardTitle>
          </CardHeader>
          <CardContent>
            {reviewItems.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {reviewItems.map((it) => (
                  <Card key={`${it.fileId}:${it.topic}`} className="border bg-background/80 dark:bg-white/10 dark:border-white/10">
                    <CardContent className="p-4 space-y-2">
                      <div className="font-extrabold truncate">{it.fileName}</div>
                      <div className="text-sm text-muted-foreground leading-7">{it.hint}</div>
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          size="sm"
                          className="gap-2"
                          onClick={() => {
                            sessionStorage.setItem("aass:active_file_id", it.fileId);
                            sessionStorage.setItem("aass:last_uploaded_file_name", it.fileName);
                            window.location.hash = `#/explain/${it.fileId}`;
                          }}
                        >
                          مراجعة الآن
                          <ArrowLeft className="size-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            sessionStorage.setItem("aass:active_file_id", it.fileId);
                            sessionStorage.setItem("aass:last_uploaded_file_name", it.fileName);
                            window.location.hash = `#/exam/${it.fileId}`;
                          }}
                        >
                          امتحان سريع
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground leading-7">
                {user ? "لا توجد خطة مراجعة حالياً — أكمل امتحاناً أولاً لتظهر توصيات ذكية." : "سجّل دخولك أولاً لتفعيل خطة المراجعة."}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Continue Studying */}
        <Card className="border bg-background/70 dark:bg-white/10 dark:backdrop-blur-md dark:border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl">آخر الملفات</CardTitle>
          </CardHeader>
          <CardContent>
            {user && recent.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2">
                {recent.map((r: any) => (
                  <Card key={r.id} className="border bg-background/80 dark:bg-white/10 dark:border-white/10">
                    <CardContent className="p-4 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-bold truncate">{r.fileName}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          تم الرفع: {String(r.uploadedAt).slice(0, 10)}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        className="shrink-0"
                        onClick={() => {
                          sessionStorage.setItem("aass:active_file_id", r.id);
                          sessionStorage.setItem("aass:last_uploaded_file_name", r.fileName);
                          window.location.hash = `#/explain/${r.id}`;
                        }}
                      >
                        متابعة
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground leading-7">
                {user
                  ? "لم يتم فتح ملفات بعد. افتح ملفاً من (مكتبتي) وسيظهر هنا تلقائياً."
                  : "سجّل دخولك أولاً ليتم حفظ آخر ملفاتك وظهورها هنا."}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick snapshot */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="dark:bg-white/10 dark:backdrop-blur-md dark:border-white/10">
            <CardHeader className="flex-row items-start justify-between space-y-0 pb-2">
              <CardTitle className="text-base">الملفات في مكتبتي</CardTitle>
              <div className="size-10 rounded-xl bg-secondary grid place-items-center">
                <FileText className="size-5" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-extrabold">{libraryCount}</div>
              <div className="text-xs text-muted-foreground mt-1">بيانات حقيقية من المكتبة</div>
            </CardContent>
          </Card>

          <Card className="dark:bg-white/10 dark:backdrop-blur-md dark:border-white/10">
            <CardHeader className="flex-row items-start justify-between space-y-0 pb-2">
              <CardTitle className="text-base">الأسئلة المُجابة</CardTitle>
              <div className="size-10 rounded-xl bg-secondary grid place-items-center">
                <CheckCircle2 className="size-5" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-extrabold">{answeredCount}</div>
              <div className="text-xs text-muted-foreground mt-1">بيانات حقيقية</div>
            </CardContent>
          </Card>

          <Card className="dark:bg-white/10 dark:backdrop-blur-md dark:border-white/10">
            <CardHeader className="flex-row items-start justify-between space-y-0 pb-2">
              <CardTitle className="text-base">XP</CardTitle>
              <div className="size-10 rounded-xl bg-secondary grid place-items-center">
                <Timer className="size-5" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-extrabold tabular-nums">{xp}</div>
              <div className="text-xs text-muted-foreground mt-1">بيانات حقيقية من الحساب</div>
            </CardContent>
          </Card>

          <Card className="dark:bg-white/10 dark:backdrop-blur-md dark:border-white/10">
            <CardHeader className="flex-row items-start justify-between space-y-0 pb-2">
              <CardTitle className="text-base">Coins</CardTitle>
              <div className="size-10 rounded-xl bg-secondary grid place-items-center">
                <Coins className="size-5" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-extrabold tabular-nums">{coins}</div>
              <div className="text-xs text-muted-foreground mt-1">يتحدث تلقائياً بعد الشراء</div>
            </CardContent>
          </Card>
        </div>
      </section>
    </AppShell>
  );
}
