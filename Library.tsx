import * as React from "react";
import { useLocation } from "wouter";
import { BookOpen, Brain, Calendar, Download, FileText } from "lucide-react";

import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cloudAuthEnabled, getCurrentUser } from "@/lib/auth";
import { readLibrary } from "@/lib/library-store";
import { getSupabaseClient } from "@/lib/supabase";
import { createPdfSignedUrl } from "@/lib/cloud-storage";

import { pushRecentFile } from "@/lib/dashboard-metrics";
import { cn } from "@/lib/utils";
import AdUnit from "@/components/ads/AdUnit";

const glassCard =
  "dark:bg-white/10 dark:backdrop-blur-md dark:border-white/10";

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("ar-EG", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatBytes(bytes: number) {
  if (!bytes || bytes <= 0) return "0 B";
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(2)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}

export default function LibraryPage() {
  const [, navigate] = useLocation();

  const [loading, setLoading] = React.useState(true);
  const [items, setItems] = React.useState<any[]>([]);

  React.useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => {
      const user = getCurrentUser();
      if (!user) {
        setItems([]);
        setLoading(false);
        return;
      }
      if (cloudAuthEnabled()) {
        // في وضع السحابة: نقرأ من جدول files للحصول على pdf_path والحجم
        const sb = getSupabaseClient();
        if (!sb) {
          setItems(readLibrary(user.id));
          setLoading(false);
          return;
        }

        (async () => {
          try {
            const { data, error } = await sb
              .from("files")
              .select("id,name,created_at,pdf_path,file_size_bytes")
              .eq("user_id", user.id)
              .order("created_at", { ascending: false })
              .limit(500);

            if (error) throw error;

            setItems(
              (data || []).map((r: any) => ({
                id: String(r.id),
                fileName: String(r.name),
                uploadedAt: String(r.created_at || new Date().toISOString()),
                pdfPath: String(r.pdf_path || ""),
                fileSizeBytes: Number(r.file_size_bytes || 0),
                hasAnalysis: false,
              }))
            );
          } catch {
            setItems(readLibrary(user.id));
          } finally {
            setLoading(false);
          }
        })();
        return;
      }

      setItems(readLibrary(user.id));
      setLoading(false);
    }, 650);

    return () => clearTimeout(t);
  }, []);

  const user = getCurrentUser();

  return (
    <AppShell>
      <section className="mx-auto w-full max-w-6xl space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl md:text-4xl font-extrabold">مكتبتي</h1>
          <p className="text-muted-foreground leading-7">
            ملفاتك التي تم رفعها وتحليلها سابقاً — مع حفظ النتائج لتجنب إعادة استهلاك الـ API.
          </p>
        </div>

        {!user && (
          <Card className={cn(glassCard)}>
            <CardContent className="pt-6 space-y-3">
              <div className="font-extrabold">لا يوجد مستخدم مسجل حالياً</div>
              <div className="text-sm text-muted-foreground leading-7">
                سجّل الدخول/أنشئ حساباً لتفعيل المكتبة الدائمة ومزامنتها مع السحابة.
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button onClick={() => navigate("/auth")}>الذهاب لصفحة الحساب</Button>
                <Button variant="outline" onClick={() => navigate("/رفع-المادة")}>
                  رفع ملف الآن
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {user && (
          <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            {loading && (
              <>
                {Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i} className={cn(glassCard)}>
                    <CardHeader className="pb-2">
                      <Skeleton className="h-6 w-3/4" />
                      <Skeleton className="h-4 w-1/2 mt-2" />
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </>
            )}

            {!loading && items.length === 0 && (
              <Card className={cn(glassCard)}>
                <CardContent className="pt-6 space-y-3">
                  <div className="font-extrabold">مكتبتك فارغة</div>
                  <div className="text-sm text-muted-foreground leading-7">
                    ارفع ملفاً من صفحة "رفع الماتيريال" وسيظهر هنا بعد الاستخراج والتحليل.
                  </div>
                  <Button onClick={() => navigate("/رفع-المادة")}>رفع الماتيريال</Button>
                </CardContent>
              </Card>
            )}

            {!loading &&
              items.map((it: any) => (
                <Card key={it.id} className={cn(glassCard)}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xl flex items-start gap-2">
                      <FileText className="size-5 mt-0.5" />
                      <span className="leading-7">{it.fileName}</span>
                    </CardTitle>
                    <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-2 mt-2">
                      <Calendar className="size-4" />
                      <span>{formatDate(it.uploadedAt)}</span>
                      {typeof it.extractedChars === "number" && (
                        <span>• {it.extractedChars.toLocaleString()} حرف</span>
                      )}
                      {typeof it.fileSizeBytes === "number" && it.fileSizeBytes > 0 && (
                        <span>• {formatBytes(it.fileSizeBytes)}</span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    <Button
                      className="gap-2"
                      onClick={() => {
                        sessionStorage.setItem("aass:active_file_id", it.id);
                        sessionStorage.setItem("aass:last_uploaded_file_name", it.fileName);
                        const u = getCurrentUser();
                        if (u) {
                          pushRecentFile(u.id, {
                            id: it.id,
                            fileName: it.fileName,
                            uploadedAt: it.uploadedAt,
                          });
                        }
                        navigate(`/explain/${it.id}`);
                      }}
                    >
                      <BookOpen className="size-4" />
                      مراجعة الشرح
                    </Button>
                    <Button
                      variant="secondary"
                      className="gap-2"
                      onClick={() => {
                        sessionStorage.setItem("aass:active_file_id", it.id);
                        sessionStorage.setItem("aass:last_uploaded_file_name", it.fileName);
                        const u = getCurrentUser();
                        if (u) {
                          pushRecentFile(u.id, {
                            id: it.id,
                            fileName: it.fileName,
                            uploadedAt: it.uploadedAt,
                          });
                        }
                        // فتح الكويز المرتبط بنفس الملف (Deep link)
                        navigate(`/بنك-الأسئلة/${it.id}`);
                      }}
                    >
                      <Brain className="size-4" />
                      فتح الكويز
                    </Button>

                    {cloudAuthEnabled() && it.pdfPath && (
                      <Button
                        variant="outline"
                        className="gap-2"
                        onClick={async () => {
                          const u = getCurrentUser();
                          if (!u) return;
                          try {
                            const url = await createPdfSignedUrl({
                              user: u,
                              pdfPath: it.pdfPath,
                              expiresInSec: 60 * 10,
                            });
                            window.open(url, "_blank", "noopener,noreferrer");
                          } catch {
                            // ignore
                          }
                        }}
                      >
                        <Download className="size-4" />
                        تحميل PDF
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
          </div>

          {/* Ad slot (Library - bottom) */}
          <AdUnit slot={(import.meta.env.VITE_ADSENSE_SLOT || "") as any} />
          </div>
        )}
      </section>
    </AppShell>
  );
}
