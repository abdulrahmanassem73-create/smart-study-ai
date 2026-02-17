import * as React from "react";
import { motion } from "framer-motion";
import { Coins, Sparkles, Wand2, CreditCard } from "lucide-react";

import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

import { cloudAuthEnabled, getCurrentUser } from "@/lib/auth";
import { getSupabaseClient } from "@/lib/supabase";
import { getCachedStatsForHeader, getOrCreateStats } from "@/lib/user-stats";
import { getOrCreateSettings, updateSettings } from "@/lib/user-settings";
import { fireLevelUpConfetti } from "@/lib/confetti";

const glassCard = "dark:bg-white/10 dark:backdrop-blur-md dark:border-white/10";

const PRICE_PRO_SUMMARY = 50;

const PRICE_THEME_NEON = 200;
const PRICE_THEME_DARK_PRO = 150;
const PRICE_GOLDEN_TICKET = 75; // تزيد 5 أسئلة في تحليل واحد

export default function ShopPage() {
  const user = getCurrentUser();
  const [stats, setStats] = React.useState(() => getCachedStatsForHeader());
  const [buying, setBuying] = React.useState(false);

  React.useEffect(() => {
    const onStats = (e: any) => setStats(e?.detail || getCachedStatsForHeader());
    window.addEventListener("aass:stats_updated", onStats as any);
    return () => window.removeEventListener("aass:stats_updated", onStats as any);
  }, []);

  const coins = Math.max(0, Number((stats as any)?.coins || 0));

  const buyCoinsPackage = async (packageId: string) => {
    if (!user) {
      toast.error("سجّل دخولك أولاً");
      return;
    }
    if (!cloudAuthEnabled()) {
      toast.error("فعّل السحابة أولاً (Supabase)");
      return;
    }

    const sb = getSupabaseClient();
    if (!sb) {
      toast.error("تعذر الاتصال بالسحابة");
      return;
    }

    setBuying(true);
    try {
      const { data, error } = await sb.functions.invoke("create-checkout-session", {
        body: { packageId },
      });
      if (error) throw error;

      const url = String((data as any)?.url || "");
      if (!url) {
        toast.error("تعذر بدء عملية الدفع");
        return;
      }

      toast.message("جاري تحويلك لبوابة الدفع...");
      window.location.href = url;
    } catch (e: any) {
      console.error(e);
      toast.error("فشل بدء عملية الدفع");
    } finally {
      setBuying(false);
    }
  };

  const buyTheme = async (theme: "neon" | "dark-pro") => {
    if (!user) {
      toast.error("سجّل دخولك أولاً");
      return;
    }
    if (!cloudAuthEnabled()) {
      toast.error("فعّل السحابة أولاً (Supabase)");
      return;
    }

    // السعر الحقيقي يتم التحقق منه في السيرفر داخل secure_purchase
    const price = theme === "neon" ? PRICE_THEME_NEON : PRICE_THEME_DARK_PRO;
    if (coins < price) {
      toast.error("رصيد Coins غير كافي");
      return;
    }

    const sb = getSupabaseClient();
    if (!sb) {
      toast.error("تعذر الاتصال بالسحابة");
      return;
    }

    setBuying(true);
    try {
      const { data, error } = await sb.rpc("secure_purchase", {
        item_id_input: `theme:${theme}`,
      });

      if (error) {
        const msg = String((error as any).message || "");
        if (msg.includes("INSUFFICIENT")) toast.error("رصيد Coins غير كافي");
        else toast.error("فشلت عملية الشراء");
        return;
      }

      // تحديث الإعدادات محلياً + تطبيق فوري
      await getOrCreateSettings(user);
      await updateSettings(user, { theme });

      document.documentElement.classList.remove("theme-neon", "theme-dark-pro");
      if (theme === "neon") document.documentElement.classList.add("theme-neon");
      if (theme === "dark-pro") document.documentElement.classList.add("theme-dark-pro");

      // تحديث رصيد الهيدر من السيرفر
      await getOrCreateStats(user);

      fireLevelUpConfetti();
      const after = Number((data as any)?.coins_after ?? NaN);
      toast.success(Number.isFinite(after) ? `تم الشراء! رصيدك الآن: ${after} Coins` : "تم تفعيل الثيم بنجاح!");
    } catch (e: any) {
      console.error(e);
      toast.error("فشلت عملية الشراء");
    } finally {
      setBuying(false);
    }
  };

  const buyGoldenTicket = async () => {
    if (!user) {
      toast.error("سجّل دخولك أولاً");
      return;
    }
    if (!cloudAuthEnabled()) {
      toast.error("فعّل السحابة أولاً (Supabase)");
      return;
    }

    // السعر الحقيقي يتم التحقق منه في السيرفر داخل secure_purchase
    if (coins < PRICE_GOLDEN_TICKET) {
      toast.error("رصيد Coins غير كافي");
      return;
    }

    const sb = getSupabaseClient();
    if (!sb) {
      toast.error("تعذر الاتصال بالسحابة");
      return;
    }

    setBuying(true);
    try {
      const { data, error } = await sb.rpc("secure_purchase", {
        item_id_input: "golden_ticket:+5_questions",
      });

      if (error) {
        const msg = String((error as any).message || "");
        if (msg.includes("INSUFFICIENT")) toast.error("رصيد Coins غير كافي");
        else toast.error("فشلت عملية الشراء");
        return;
      }

      // تحديث الإعدادات من السيرفر
      const nextTickets = Number((data as any)?.golden_tickets ?? NaN);
      if (Number.isFinite(nextTickets)) {
        await updateSettings(user, { golden_tickets: nextTickets });
      } else {
        const s = await getOrCreateSettings(user);
        await updateSettings(user, { golden_tickets: Number(s.golden_tickets || 0) + 1 });
      }

      await getOrCreateStats(user);

      const after = Number((data as any)?.coins_after ?? NaN);
      toast.success(
        Number.isFinite(after)
          ? `تم شراء التذكرة الذهبية! رصيدك الآن: ${after} Coins`
          : "تم شراء تذكرة ذهبية: +5 أسئلة في تحليل واحد"
      );
    } catch (e: any) {
      console.error(e);
      toast.error("فشلت عملية الشراء");
    } finally {
      setBuying(false);
    }
  };

  const [rewarding, setRewarding] = React.useState(false);
  const [adSimSeconds, setAdSimSeconds] = React.useState(0);

  // "شاهد واربح" (محاكاة) → المنح الحقيقي يتم على السيرفر عبر Edge Function reward-ad
  // والتي تستدعي RPC: reward_user_for_ad باستخدام service role (لمنع التلاعب).
  const watchAdForCoins = async () => {
    if (!user) {
      toast.error("سجّل دخولك أولاً");
      return;
    }
    if (!cloudAuthEnabled()) {
      toast.error("فعّل السحابة أولاً (Supabase)");
      return;
    }

    const sb = getSupabaseClient();
    if (!sb) {
      toast.error("تعذر الاتصال بالسحابة");
      return;
    }

    if (rewarding) return;

    // 1) محاكاة عرض الإعلان (3 ثوان)
    setRewarding(true);
    setAdSimSeconds(3);

    await new Promise<void>((resolve) => {
      const t = window.setInterval(() => {
        setAdSimSeconds((s) => {
          const next = s - 1;
          if (next <= 0) {
            window.clearInterval(t);
            resolve();
            return 0;
          }
          return next;
        });
      }, 1000);
    });

    // 2) منح المكافأة من السيرفر
    try {
      const adEventId = `ad_${user.id}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      const { data, error } = await sb.functions.invoke("reward-ad", {
        body: { adEventId, coinsReward: 5 },
      });
      if (error) throw error;

      await getOrCreateStats(user);

      const after = Number((data as any)?.coins_after ?? NaN);
      toast.success(Number.isFinite(after) ? `+5 Coins! رصيدك الآن: ${after}` : "+5 Coins تم منحها");
    } catch (e: any) {
      console.error(e);
      toast.error("فشل منح المكافأة");
    } finally {
      setRewarding(false);
      setAdSimSeconds(0);
    }
  };

  const buyProSummary = async () => {
    if (!user) {
      toast.error("سجّل دخولك أولاً");
      return;
    }
    if (!cloudAuthEnabled()) {
      toast.error("فعّل السحابة أولاً (Supabase)");
      return;
    }

    // السعر الحقيقي يتم التحقق منه في السيرفر داخل secure_purchase
    if (coins < PRICE_PRO_SUMMARY) {
      toast.error("رصيد Coins غير كافي");
      return;
    }

    const sb = getSupabaseClient();
    if (!sb) {
      toast.error("تعذر الاتصال بالسحابة");
      return;
    }

    setBuying(true);
    try {
      const { data, error } = await sb.rpc("secure_purchase", {
        item_id_input: "pro_summary",
      });

      if (error) {
        const msg = String((error as any).message || "");
        if (msg.includes("INSUFFICIENT")) toast.error("رصيد Coins غير كافي");
        else toast.error("فشلت عملية الشراء");
        return;
      }

      await getOrCreateStats(user);
      fireLevelUpConfetti();

      const after = Number((data as any)?.coins_after ?? NaN);
      toast.success(Number.isFinite(after) ? `تم الشراء! رصيدك الآن: ${after} Coins` : "تم شراء ميزة التلخيص الاحترافي بنجاح!");
    } catch (e: any) {
      console.error(e);
      toast.error("فشلت عملية الشراء");
    } finally {
      setBuying(false);
    }
  };

  return (
    <AppShell>
      <section className="mx-auto w-full max-w-5xl space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl md:text-4xl font-extrabold">المتجر</h1>
            <p className="text-muted-foreground leading-7">
              استخدم Coins لفتح ميزات قوية داخل المنصة.
            </p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className={
              "inline-flex items-center gap-2 rounded-2xl border px-4 py-3 bg-muted/25 " +
              glassCard
            }
          >
            <Coins className="size-5 text-yellow-500" />
            <div className="text-sm">
              <div className="text-xs text-muted-foreground">رصيدك الحالي</div>
              <div className="text-lg font-extrabold tabular-nums">{coins}</div>
            </div>
          </motion.div>
        </div>

        <Separator />

        <div className="grid gap-4 md:grid-cols-2">
          {/* Coins Top-up (Real Payments) */}
          <Card className={glassCard}>
            <CardHeader className="pb-3">
              <CardTitle className="text-xl flex items-center gap-2">
                <CreditCard className="size-5 text-primary" />
                شحن الرصيد (Coins)
              </CardTitle>
              <div className="text-xs text-muted-foreground leading-6">
                شحن حقيقي عبر بوابة دفع (يتطلب تفعيل Stripe + Webhook على السيرفر).
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2">
                <Button
                  variant="outline"
                  className="justify-between"
                  disabled={buying}
                  onClick={() => buyCoinsPackage("coins_200")}
                >
                  <span>200 Coins</span>
                  <span className="font-extrabold">\$1.99</span>
                </Button>
                <Button
                  variant="outline"
                  className="justify-between"
                  disabled={buying}
                  onClick={() => buyCoinsPackage("coins_600")}
                >
                  <span>600 Coins</span>
                  <span className="font-extrabold">\$4.99</span>
                </Button>
                <Button
                  variant="outline"
                  className="justify-between"
                  disabled={buying}
                  onClick={() => buyCoinsPackage("coins_1500")}
                >
                  <span>1500 Coins</span>
                  <span className="font-extrabold">\$9.99</span>
                </Button>
              </div>

              <div className="rounded-xl border bg-gradient-to-br from-secondary/35 to-background p-4 overflow-hidden relative">
                <div className="absolute inset-0 opacity-60 pointer-events-none" style={{
                  background:
                    "radial-gradient(800px 220px at 10% 10%, color-mix(in oklch, var(--primary) 18%, transparent) 0%, transparent 55%), radial-gradient(800px 220px at 90% 30%, color-mix(in oklch, var(--primary) 10%, transparent) 0%, transparent 55%)",
                }} />

                <div className="relative">
                  <div className="font-extrabold">احصل على 5 عملات مجاناً!</div>
                  <div className="text-xs text-muted-foreground leading-6 mt-1">
                    شاهد إعلان (محاكاة) — وبعد انتهاء المشاهدة سيتم منح المكافأة **من السيرفر** لمنع أي تلاعب.
                  </div>

                  {rewarding ? (
                    <div className="mt-3 rounded-lg border bg-background/70 p-3">
                      <div className="text-sm font-bold">جاري تشغيل الإعلان…</div>
                      <div className="text-xs text-muted-foreground mt-1">الوقت المتبقي: {adSimSeconds} ث</div>
                      <div className="mt-2 h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${Math.max(0, Math.min(100, ((3 - adSimSeconds) / 3) * 100))}%` }}
                        />
                      </div>
                    </div>
                  ) : null}

                  <Button
                    className="w-full mt-3"
                    variant="outline"
                    onClick={watchAdForCoins}
                    disabled={rewarding || buying}
                  >
                    {rewarding ? "جاري منح المكافأة..." : "شاهد واربح"}
                  </Button>
                </div>
              </div>

              <div className="text-xs text-muted-foreground leading-6">
                بعد إتمام الدفع سيتم تحديث رصيدك تلقائياً خلال ثوانٍ عبر Webhook.
              </div>
            </CardContent>
          </Card>
          {/* Themes */}
          <Card className={glassCard}>
            <CardHeader className="pb-3">
              <CardTitle className="text-xl flex items-center gap-2">
                <Sparkles className="size-5 text-primary" />
                ثيمات الموقع
              </CardTitle>
              <div className="text-xs text-muted-foreground leading-6">
                استبدل Coins لتغيير شكل المنصة فوراً.
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3">
                <div className="rounded-xl border p-4 bg-secondary/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-extrabold">Neon</div>
                      <div className="text-xs text-muted-foreground mt-1">ألوان نيّون عالية التباين</div>
                    </div>
                    <div className="inline-flex items-center gap-1 font-extrabold">
                      <Coins className="size-4 text-yellow-500" />
                      <span className="tabular-nums">{PRICE_THEME_NEON}</span>
                    </div>
                  </div>
                  <Button
                    className="w-full mt-3"
                    onClick={() => buyTheme("neon")}
                    disabled={buying || !user || coins < PRICE_THEME_NEON}
                  >
                    تفعيل Neon
                  </Button>
                </div>

                <div className="rounded-xl border p-4 bg-secondary/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-extrabold">Dark Pro</div>
                      <div className="text-xs text-muted-foreground mt-1">داكن أكثر عمقاً مع Accent سماوي</div>
                    </div>
                    <div className="inline-flex items-center gap-1 font-extrabold">
                      <Coins className="size-4 text-yellow-500" />
                      <span className="tabular-nums">{PRICE_THEME_DARK_PRO}</span>
                    </div>
                  </div>
                  <Button
                    className="w-full mt-3"
                    variant="outline"
                    onClick={() => buyTheme("dark-pro")}
                    disabled={buying || !user || coins < PRICE_THEME_DARK_PRO}
                  >
                    تفعيل Dark Pro
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Golden Tickets */}
          <Card className={glassCard}>
            <CardHeader className="pb-3">
              <CardTitle className="text-xl flex items-center gap-2">
                <Coins className="size-5 text-yellow-500" />
                التذاكر الذهبية
              </CardTitle>
              <div className="text-xs text-muted-foreground leading-6">
                كل تذكرة تُستخدم مرة واحدة وتزيد عدد أسئلة الذكاء الاصطناعي (+5) عند تحليل ملف جديد.
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border p-4 bg-secondary/20">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-extrabold">تذكرة واحدة</div>
                  <div className="inline-flex items-center gap-1 font-extrabold">
                    <Coins className="size-4 text-yellow-500" />
                    <span className="tabular-nums">{PRICE_GOLDEN_TICKET}</span>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-2 leading-6">
                  سيتم استهلاك تذكرة تلقائياً عند اكتمال رفع وتحليل الملف.
                </div>
              </div>

              <Button
                className="w-full"
                onClick={buyGoldenTicket}
                disabled={buying || !user || coins < PRICE_GOLDEN_TICKET}
              >
                شراء تذكرة ذهبية
              </Button>
            </CardContent>
          </Card>

          {/* Legacy item */}
          <Card className={glassCard}>
            <CardHeader className="pb-3">
              <CardTitle className="text-xl flex items-center gap-2">
                <Sparkles className="size-5 text-primary" />
                ميزة التلخيص الاحترافي
              </CardTitle>
              <div className="text-xs text-muted-foreground leading-6">
                تلخيص أكثر ترتيباً + نقاط عملية + أسئلة مراجعة مركزة.
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border p-4 bg-secondary/20">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-extrabold">السعر</div>
                  <div className="inline-flex items-center gap-1 font-extrabold">
                    <Coins className="size-4 text-yellow-500" />
                    <span className="tabular-nums">{PRICE_PRO_SUMMARY}</span>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-2 leading-6">
                  بعد الشراء سيتم تفعيل الميزة على حسابك (الخطوة القادمة: ربطها بزر داخل صفحة الشرح).
                </div>
              </div>

              <Button
                className="w-full gap-2"
                onClick={buyProSummary}
                disabled={buying || !user || coins < PRICE_PRO_SUMMARY}
              >
                <Wand2 className="size-4" />
                {buying ? "جاري الشراء..." : coins < PRICE_PRO_SUMMARY ? "Coins غير كافية" : "شراء الآن"}
              </Button>

              {!user && (
                <div className="text-xs text-muted-foreground">
                  سجّل دخولك لتظهر بيانات الرصيد وتعمل عمليات الشراء.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </AppShell>
  );
}
