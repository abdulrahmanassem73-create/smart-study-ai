import * as React from "react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";
import AdUnit from "@/components/ads/AdUnit";
import { Download, Play, Send, TimerReset } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { cloudAuthEnabled, getCurrentUser } from "@/lib/auth";
import { geminiEnabled } from "@/lib/gemini-study-pack";
import { generateExam, submitExam, type ExamQuestion } from "@/lib/gemini-chat";
import { getSupabaseClient } from "@/lib/supabase";

const MarkdownView = React.lazy(() => import("@/components/markdown/MarkdownView"));

type ExamState = {
  examId: string;
  title: string;
  durationSec: number;
  questions: ExamQuestion[];
};

type AnswerRow = { id: string; selectedIndex: number | null };

function formatTime(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export default function ExamPage() {
  const [, navigate] = useLocation();

  const params = useParams() as { fileId?: string };

  const fileId = React.useMemo(() => {
    const fromParam = String(params?.fileId || "").trim();
    const fromSession = sessionStorage.getItem("aass:active_file_id") || "";
    const v = fromParam || fromSession;
    if (fromParam && fromParam !== fromSession) {
      sessionStorage.setItem("aass:active_file_id", fromParam);
    }
    return v;
  }, [params?.fileId]);

  const [fileName, setFileName] = React.useState(
    sessionStorage.getItem("aass:last_uploaded_file_name") || "(ملف غير محدد)"
  );

  const [loading, setLoading] = React.useState(false);

  // Fetch file name immediately from DB when using deep link
  React.useEffect(() => {
    if (!fileId) return;

    const u = getCurrentUser();
    const sb = getSupabaseClient();
    if (!u || !cloudAuthEnabled() || !sb) return;

    (async () => {
      try {
        const { data, error } = await sb
          .from("files")
          .select("id,name")
          .eq("user_id", u.id)
          .eq("id", fileId)
          .maybeSingle();

        // Track last opened for smart reminders (best effort)
        try {
          await sb
            .from("files")
            .update({ last_opened_at: new Date().toISOString() } as any)
            .eq("user_id", u.id)
            .eq("id", fileId);
        } catch {
          // ignore
        }

        if (error) throw error;
        if (!data) throw new Error("FILE_NOT_FOUND");

        const name = String((data as any).name || "(ملف)");
        setFileName(name);
        sessionStorage.setItem("aass:last_uploaded_file_name", name);
      } catch (e) {
        console.error(e);
        toast.error("الرابط غير صالح أو الملف غير موجود");
        navigate("/مكتبتي");
      }
    })();
  }, [fileId]);
  const [exam, setExam] = React.useState<ExamState | null>(null);
  const [answers, setAnswers] = React.useState<AnswerRow[]>([]);
  const [step, setStep] = React.useState(0);

  const [timeLeft, setTimeLeft] = React.useState<number>(0);
  const [submitted, setSubmitted] = React.useState(false);
  const [report, setReport] = React.useState<string>("");
  const [score, setScore] = React.useState<number | null>(null);
  const [total, setTotal] = React.useState<number | null>(null);

  const [wrongItems, setWrongItems] = React.useState<any[]>([]);
  const [studyPlan, setStudyPlan] = React.useState<any[]>([]);
  const [weakTopics, setWeakTopics] = React.useState<string[]>([]);

  const q = exam?.questions?.[Math.min(step, (exam?.questions?.length || 1) - 1)] || null;

  // Countdown
  React.useEffect(() => {
    if (!exam) return;
    if (submitted) return;
    if (timeLeft <= 0) return;

    const t = window.setInterval(() => {
      setTimeLeft((x) => x - 1);
    }, 1000);

    return () => window.clearInterval(t);
  }, [exam, timeLeft, submitted]);

  React.useEffect(() => {
    if (!exam) return;
    if (submitted) return;
    if (timeLeft > 0) return;
    // Auto submit when timer ends
    if (exam && answers.length) {
      void handleSubmit(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  const startExam = async () => {
    const u = getCurrentUser();
    if (!u || !cloudAuthEnabled()) {
      toast.error("لازم تسجل دخول عشان وضع الامتحان");
      navigate("/auth");
      return;
    }

    if (!geminiEnabled()) {
      toast.error("الذكاء الاصطناعي غير مُفعل حالياً");
      return;
    }

    if (!fileId) {
      toast.error("اختار ملف من المكتبة/ارفع ملف أولاً");
      navigate("/مكتبتي");
      return;
    }

    setLoading(true);
    setSubmitted(false);
    setReport("");
    setScore(null);
    setTotal(null);
    setWrongItems([]);
    setStudyPlan([]);
    setWeakTopics([]);

    try {
      const res = await generateExam({
        fileId,
        title: `امتحان: ${fileName}`,
        questionCount: 15,
        durationSec: 1800,
      });

      setExam(res);
      setAnswers(res.questions.map((qq) => ({ id: qq.id, selectedIndex: null })));
      setStep(0);
      setTimeLeft(res.durationSec);

      toast.success("تم توليد الامتحان");
    } catch {
      toast.error("فشل توليد الامتحان");
    } finally {
      setLoading(false);
    }
  };

  const pick = (questionId: string, idx: number) => {
    if (submitted) return;
    setAnswers((prev) => prev.map((a) => (a.id === questionId ? { ...a, selectedIndex: idx } : a)));
  };

  const answeredCount = answers.filter((a) => a.selectedIndex !== null).length;
  const progress = exam ? Math.round((answeredCount / exam.questions.length) * 100) : 0;

  const handleSubmit = async (auto = false) => {
    if (!exam) return;
    if (submitted) return;

    const unanswered = answers.filter((a) => a.selectedIndex === null).length;
    if (!auto && unanswered > 0) {
      toast.error("لازم تجاوب على كل الأسئلة قبل التسليم");
      return;
    }

    setLoading(true);
    try {
      const res = await submitExam({
        examId: exam.examId,
        fileId,
        answers,
      });

      setSubmitted(true);
      setScore(res.score);
      setTotal(res.total);
      setReport(res.report_markdown || "");
      setWrongItems(Array.isArray((res as any).wrong_items) ? (res as any).wrong_items : []);
      setStudyPlan(Array.isArray((res as any).study_plan) ? (res as any).study_plan : []);
      setWeakTopics(Array.isArray((res as any).weak_topics) ? (res as any).weak_topics.map(String) : []);
      toast.success("تم تصحيح الامتحان وإنشاء تقرير الأداء");
    } catch {
      toast.error("فشل تصحيح الامتحان");
    } finally {
      setLoading(false);
    }
  };

  const exportPdf = () => {
    toast.message("سيتم فتح نافذة الطباعة — اختر Save as PDF");
    window.print();
  };

  const exportMistakesPdf = () => {
    const w = window.open("", "_blank", "noopener,noreferrer");
    if (!w) {
      toast.error("تعذر فتح نافذة جديدة لإنشاء PDF");
      return;
    }

    const topics = weakTopics.length ? weakTopics : Array.from(new Set(wrongItems.map((x: any) => String(x?.topic || "").trim()).filter(Boolean)));

    const rows = wrongItems
      .slice(0, 30)
      .map(
        (wi: any) => `
          <div class="card">
            <div class="title">${String(wi.topic || "موضوع")} <span class="muted">(${String(wi.id || "")})</span></div>
            <div><b>لماذا أخطأت:</b> ${String(wi.why_wrong || "")}</div>
            <div><b>ما الذي تراجعه:</b> ${String(wi.what_to_review || "")}</div>
            <div class="quote">"${String(wi.reference_quote || "")}"</div>
          </div>
        `
      )
      .join("\n");

    const planHtml = Array.isArray(studyPlan) && studyPlan.length
      ? `<div class="card"><div class="title">خطة مراجعة مختصرة</div><ul>${studyPlan
          .slice(0, 10)
          .map((x: any) => `<li>${String(x)}</li>`)
          .join("")}</ul></div>`
      : "";

    const topicHtml = topics.length
      ? `<div class="card"><div class="title">الموضوعات الأضعف</div><div class="tags">${topics
          .slice(0, 12)
          .map((t) => `<span class="tag">${t}</span>`)
          .join("")}</div></div>`
      : "";

    const doc = `
      <!doctype html>
      <html lang="ar" dir="rtl">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>ملخص الأخطاء الشائعة</title>
          <style>
            body { font-family: "Almarai", Arial, sans-serif; padding: 24px; }
            h1,h2 { font-family: "Changa", Arial, sans-serif; margin: 0 0 12px; }
            .muted { color: #666; }
            .card { border: 1px solid #ddd; border-radius: 12px; padding: 14px; margin: 12px 0; }
            .title { font-weight: 800; margin-bottom: 8px; }
            .quote { margin-top: 8px; padding: 10px; border-right: 4px solid #999; background: #fafafa; color: #333; }
            ul { margin: 8px 0 0; padding: 0 18px 0 0; }
            li { margin: 6px 0; }
            .tags { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
            .tag { border: 1px solid #ddd; border-radius: 999px; padding: 6px 10px; font-size: 12px; background: #f6f6f6; }
            @media print { a { display: none; } }
          </style>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
          <link href="https://fonts.googleapis.com/css2?family=Almarai:wght@300;400;700;800&family=Changa:wght@400;600;700;800&display=swap" rel="stylesheet" />
        </head>
        <body>
          <h1>ملخص الأخطاء الشائعة</h1>
          <div class="muted">${fileName} • ${new Date().toLocaleDateString("ar-EG")}</div>

          ${topicHtml}
          ${planHtml}

          <h2>تفاصيل الأخطاء</h2>
          ${rows || '<div class="muted">لا توجد أخطاء مسجلة.</div>'}

          <script>
            setTimeout(() => { window.print(); }, 250);
          </script>
        </body>
      </html>
    `;

    w.document.open();
    w.document.write(doc);
    w.document.close();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Exam Mode header (no sidebar / no helpers) */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur print:hidden">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="font-extrabold truncate">وضع الامتحان</div>
            <div className="text-xs text-muted-foreground truncate">{fileName}</div>
          </div>
          <div className="flex items-center gap-2">
            {exam ? (
              <div
                className={cn(
                  "rounded-full border px-3 py-1 text-sm font-bold",
                  timeLeft <= 60 ? "text-destructive border-destructive/40" : ""
                )}
                title="الوقت المتبقي"
              >
                <TimerReset className="inline size-4 ml-1" />
                {formatTime(timeLeft)}
              </div>
            ) : null}

            <Button variant="outline" onClick={() => navigate(fileId ? `/explain/${fileId}` : "/شرح")}>عودة</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 space-y-5">
        {!exam ? (
          <Card>
            <CardHeader>
              <CardTitle>ابدأ امتحان جديد</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground leading-7">
                سيقوم النظام بتوليد امتحان مخصص بناءً على محتوى الملف ونقاط ضعفك (إن وُجدت).
              </div>
              <Button className="gap-2" onClick={startExam} disabled={loading}>
                <Play className="size-4" />
                {loading ? "جاري التحضير..." : "توليد وبدء الامتحان"}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-[1fr_18rem]">
              <Card className="min-w-0">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">الأسئلة</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm text-muted-foreground">
                      تم الإجابة على: <span className="font-bold text-foreground">{answeredCount}</span> / {exam.questions.length}
                    </div>
                    <div className="text-sm font-bold">{progress}%</div>
                  </div>
                  <Progress value={progress} />

                  {q ? (
                    <div className="space-y-3">
                      <div className="text-xs text-muted-foreground">
                        المستوى: <span className="font-bold">{q.level}</span> — الموضوع: <span className="font-bold">{q.topic}</span>
                      </div>
                      <div className="text-base font-extrabold leading-7">{q.question}</div>

                      <div className="grid gap-2">
                        {q.options.map((opt, idx) => {
                          const selected = answers.find((a) => a.id === q.id)?.selectedIndex === idx;
                          return (
                            <button
                              key={idx}
                              type="button"
                              disabled={submitted}
                              onClick={() => pick(q.id, idx)}
                              className={cn(
                                "text-right rounded-xl border px-3 py-3",
                                "hover:bg-accent transition",
                                selected ? "border-primary bg-primary/5" : ""
                              )}
                            >
                              <span className="font-bold">{idx + 1}) </span>
                              {opt}
                            </button>
                          );
                        })}
                      </div>

                      <div className="flex items-center justify-between pt-2 gap-2">
                        <Button
                          variant="outline"
                          onClick={() => setStep((s) => Math.max(0, s - 1))}
                          disabled={step === 0}
                        >
                          السابق
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setStep((s) => Math.min(exam.questions.length - 1, s + 1))}
                          disabled={step >= exam.questions.length - 1}
                        >
                          التالي
                        </Button>
                      </div>

                      <Separator />

                      <div className="flex flex-wrap items-center gap-2 print:hidden">
                        <Button className="gap-2" onClick={() => handleSubmit(false)} disabled={loading || submitted}>
                          <Send className="size-4" />
                          {loading ? "جاري التصحيح..." : submitted ? "تم التسليم" : "تسليم الامتحان"}
                        </Button>
                        <Button variant="outline" className="gap-2" onClick={exportPdf}>
                          <Download className="size-4" />
                          تصدير PDF
                        </Button>
                        <Button
                          variant="secondary"
                          className="gap-2"
                          onClick={startExam}
                          disabled={loading}
                          title="توليد امتحان جديد"
                        >
                          امتحان جديد
                        </Button>
                      </div>

                      {submitted && score !== null ? (
                        <div className="rounded-xl border p-3 bg-secondary/20">
                          <div className="font-extrabold">النتيجة: {score} / {total}</div>
                          <div className="text-sm text-muted-foreground mt-1">
                            راجع تقرير الأداء بالأسفل لمعرفة سبب الأخطاء وما يجب إعادة قراءته.
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <Card className="print:hidden">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">خريطة الامتحان</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm leading-7">
                  <div>Direct: 40%</div>
                  <div>Concept Linking: 40%</div>
                  <div>Critical/Case: 20%</div>
                  <Separator />
                  <div className="text-muted-foreground">
                    *في وضع الامتحان تم إخفاء أدوات المساعدة بالكامل.*
                  </div>
                </CardContent>
              </Card>
            </div>

            {submitted && report.trim() ? (
              <>
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-lg">تقرير الأداء</CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 print:hidden"
                      onClick={exportMistakesPdf}
                      disabled={!wrongItems.length && !studyPlan.length && !weakTopics.length}
                      title="يفتح نافذة الطباعة للحفظ PDF"
                    >
                      <Download className="size-4" />
                      ملخص الأخطاء (PDF)
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <React.Suspense fallback={<div className="p-4 text-sm text-muted-foreground">جاري تحميل العارض...</div>}>
                    <MarkdownView markdown={report} components={{} as any} />
                  </React.Suspense>
                </CardContent>
              </Card>

              {/* Ad slot (Exam results) */}
              <div className="mt-5 print:hidden">
                <AdUnit slot={(import.meta.env.VITE_ADSENSE_SLOT_EXAM || import.meta.env.VITE_ADSENSE_SLOT || "") as any} />
              </div>
              </>
            ) : null}
          </>
        )}
      </main>

      {/* Print helpers */}
      <style>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
}
