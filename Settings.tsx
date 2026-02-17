import * as React from "react";
import { Download, Eraser, Save } from "lucide-react";

import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import { cloudAuthEnabled, getCurrentUser } from "@/lib/auth";
import { getOrCreateProfile, updateProfile } from "@/lib/profile-store";
import { getOrCreateSettings, updateSettings } from "@/lib/user-settings";
import { Switch } from "@/components/ui/switch";

const glassCard = "dark:bg-white/10 dark:backdrop-blur-md dark:border-white/10";

function downloadHtmlAsPrintPdf(title: string, htmlBody: string) {
  const w = window.open("", "_blank", "noopener,noreferrer");
  if (!w) {
    toast.error("تعذر فتح نافذة جديدة لإنشاء PDF");
    return;
  }

  const doc = `
  <!doctype html>
  <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${title}</title>
      <style>
        body { font-family: "Almarai", Arial, sans-serif; padding: 24px; }
        h1,h2,h3 { font-family: "Changa", Arial, sans-serif; margin: 0 0 12px; }
        .muted { color: #555; }
        .card { border: 1px solid #ddd; border-radius: 12px; padding: 16px; margin: 12px 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th, td { border: 1px solid #ddd; padding: 10px; text-align: right; }
        th { background: #f4f4f4; }
        @media print { a { display: none; } }
      </style>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
      <link href="https://fonts.googleapis.com/css2?family=Almarai:wght@300;400;700;800&family=Changa:wght@400;600;700;800&display=swap" rel="stylesheet" />
    </head>
    <body>
      ${htmlBody}
      <script>
        setTimeout(() => { window.print(); }, 200);
      </script>
    </body>
  </html>`;

  w.document.open();
  w.document.write(doc);
  w.document.close();
}

function parseStudyTitle(studyTitle: string) {
  const raw = (studyTitle || "").trim();
  if (!raw) return { university: "", major: "" };

  // ندعم أكثر من فاصل لتقليل كسر البيانات القديمة
  const separators = ["|", "—", "-", "•"];
  for (const sep of separators) {
    if (raw.includes(sep)) {
      const [a, b] = raw.split(sep);
      return {
        university: (a || "").trim(),
        major: (b || "").trim(),
      };
    }
  }

  // لو مفيش فاصل: نخليه جامعة كقيمة عامة
  return { university: raw, major: "" };
}

function buildStudyTitle(university: string, major: string) {
  const u = (university || "").trim();
  const m = (major || "").trim();
  if (u && m) return `${u} | ${m}`;
  return u || m || "";
}

export default function SettingsPage() {
  const user = getCurrentUser();
  const cloud = cloudAuthEnabled();

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  const [name, setName] = React.useState("");
  const [university, setUniversity] = React.useState("");
  const [major, setMajor] = React.useState("");
  const [adsEnabled, setAdsEnabled] = React.useState(true);

  React.useEffect(() => {
    if (!user) {
      // الوضع المحلي/بدون تسجيل دخول
      setName("مستخدم");
      setUniversity("");
      setMajor("");
      setLoading(false);
      return;
    }

    (async () => {
      try {
        setLoading(true);
        const p = await getOrCreateProfile(user);
        setName(p.display_name || user.name || "مستخدم");
        const parsed = parseStudyTitle(p.study_title || "");
        setUniversity(parsed.university || "");
        setMajor(parsed.major || "");

        const s = await getOrCreateSettings(user);
        setAdsEnabled(typeof (s as any).ads_enabled === "boolean" ? Boolean((s as any).ads_enabled) : true);
      } catch (e: any) {
        console.error(e);
        toast.error("تعذر تحميل بيانات الإعدادات");
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.id]);

  const onSave = async () => {
    if (!user) {
      toast.error("سجّل دخولك أولاً لحفظ الإعدادات بشكل دائم");
      return;
    }

    setSaving(true);
    try {
      await updateProfile(user, {
        display_name: name.trim() || user.name || "مستخدم",
        study_title: buildStudyTitle(university, major),
      } as any);

      // Ads toggle lives in user_settings
      await updateSettings(user, { ads_enabled: adsEnabled } as any);

      toast.success("تم حفظ بياناتك بشكل دائم");
    } catch (e: any) {
      console.error(e);
      toast.error("تعذر حفظ البيانات");
    } finally {
      setSaving(false);
    }
  };

  const clearHistory = () => {
    // مسح كل ما يخص النظام من sessionStorage
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith("aass:")) keysToRemove.push(k);
    }
    keysToRemove.forEach((k) => sessionStorage.removeItem(k));
    toast.success("تم مسح السجل بنجاح");
  };

  const downloadReportPdf = () => {
    const lastFile = sessionStorage.getItem("aass:last_uploaded_file_name") || "(لا يوجد)";

    const html = `
      <h1>تقرير الأداء الشامل</h1>
      <div class="muted">Academic AI Study System — v1.0</div>

      <div class="card">
        <h2>الملف الشخصي</h2>
        <div>الاسم: <b>${name || "(غير محدد)"}</b></div>
        <div>الجامعة: <b>${university || "(غير محدد)"}</b></div>
        <div>التخصص: <b>${major || "(غير محدد)"}</b></div>
      </div>

      <div class="card">
        <h2>ملخص النشاط (نسخة أولية)</h2>
        <table>
          <thead>
            <tr><th>البند</th><th>القيمة</th></tr>
          </thead>
          <tbody>
            <tr><td>آخر ملف تم رفعه</td><td>${lastFile}</td></tr>
            <tr><td>إجمالي ساعات المذاكرة</td><td>—</td></tr>
            <tr><td>متوسط الاختبارات</td><td>—</td></tr>
            <tr><td>عدد الملفات المعالجة</td><td>—</td></tr>
          </tbody>
        </table>
        <p class="muted">ملاحظة: سيتم ربط التقرير لاحقاً بإحصائيات Stats الحقيقية.</p>
      </div>
    `;

    downloadHtmlAsPrintPdf("تقرير الأداء الشامل", html);
  };

  const inputsDisabled = loading || saving;

  return (
    <AppShell>
      <section className="mx-auto w-full max-w-5xl space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl md:text-4xl font-extrabold">الإعدادات والملف الشخصي</h1>
          <p className="text-muted-foreground leading-7">
            عدّل بياناتك، وأدر سجلك، وحمّل تقرير أداء شامل (PDF عبر الطباعة).
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          {/* Profile */}
          <Card className={cn(glassCard)}>
            <CardHeader className="pb-3">
              <CardTitle className="text-xl">الملف الشخصي</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!user && (
                <div className="rounded-xl border bg-secondary/20 p-4 text-sm leading-7">
                  <div className="font-extrabold">ملحوظة</div>
                  <div className="text-muted-foreground mt-1">
                    لحفظ بياناتك بشكل دائم في قاعدة البيانات، لازم تسجل دخولك أولاً.
                  </div>
                </div>
              )}

              <div className="grid gap-2">
                <Label htmlFor="name">اسم الطالب</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={inputsDisabled}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="uni">الجامعة</Label>
                <Input
                  id="uni"
                  value={university}
                  onChange={(e) => setUniversity(e.target.value)}
                  disabled={inputsDisabled}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="major">التخصص الدراسي</Label>
                <Input
                  id="major"
                  value={major}
                  onChange={(e) => setMajor(e.target.value)}
                  disabled={inputsDisabled}
                />
              </div>

              <Separator />

              <div className="rounded-xl border bg-secondary/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-extrabold">الإعلانات</div>
                    <div className="text-xs text-muted-foreground leading-6 mt-1">
                      عند إيقافها، سيتم إخفاء مساحات الإعلانات (Placeholder) — لاستخدام باقة "بدون إعلانات" لاحقاً.
                    </div>
                  </div>
                  <Switch
                    checked={adsEnabled}
                    onCheckedChange={(v) => setAdsEnabled(Boolean(v))}
                    disabled={inputsDisabled}
                    aria-label="إظهار الإعلانات"
                  />
                </div>
              </div>

              <Separator />

              <div className="rounded-xl border bg-secondary/20 p-4">
                <div className="font-extrabold">Supabase Profiles</div>
                <div className="text-xs text-muted-foreground leading-6 mt-1">
                  يتم حفظ: <b>الاسم</b> في <code>display_name</code>، ويتم حفظ الجامعة+التخصص داخل
                  <code>study_title</code> بصيغة: <b>جامعة | تخصص</b>.
                </div>
              </div>

              <Separator />

              <div className="flex flex-wrap gap-2">
                <Button className="gap-2" onClick={onSave} disabled={!user || inputsDisabled}>
                  <Save className="size-4" />
                  حفظ التغييرات
                </Button>

                {!cloud && (
                  <div className="text-xs text-muted-foreground leading-6">
                    Supabase غير مُفعّل في البيئة — سيتم الحفظ محلياً فقط (كاش).
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Data management */}
          <Card className={cn(glassCard)}>
            <CardHeader className="pb-3">
              <CardTitle className="text-xl">إدارة البيانات</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border bg-secondary/30 p-4">
                <div className="font-extrabold">تنبيه</div>
                <div className="text-sm text-muted-foreground leading-7 mt-1">
                  مسح السجل سيحذف بيانات الجلسة الحالية (الملف الأخير، نتائج الاختبارات المحاكية، وغيرها).
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="gap-2">
                      <Eraser className="size-4" />
                      مسح السجل
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>تأكيد مسح السجل</AlertDialogTitle>
                      <AlertDialogDescription>
                        هل أنت متأكد؟ لا يمكن التراجع عن هذه العملية.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>إلغاء</AlertDialogCancel>
                      <AlertDialogAction onClick={clearHistory}>نعم، امسح</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <Button variant="outline" className="gap-2" onClick={downloadReportPdf}>
                  <Download className="size-4" />
                  تحميل تقرير الأداء الشامل (PDF)
                </Button>
              </div>

              <div className="text-xs text-muted-foreground leading-6">
                ملاحظة: تنزيل PDF يتم عبر نافذة الطباعة (اختر Save as PDF).
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </AppShell>
  );
}
