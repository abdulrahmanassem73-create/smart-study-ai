import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLocation, useParams } from "wouter";
import { BarChart3, CheckCircle2, RotateCcw, XCircle } from "lucide-react";
const QuestionPieChart = React.lazy(() => import("@/components/charts/QuestionPieChart"));
const QuestionRadarChart = React.lazy(() => import("@/components/charts/QuestionRadarChart"));
import { LoadingSpinner } from "@/components/LoadingSpinner";

import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { generateQuizMock, type QuizQuestion } from "@/lib/quiz-mock";
import { getEffectiveUserId, incrementAnsweredCount } from "@/lib/dashboard-metrics";
import { cloudAuthEnabled, getCurrentUser } from "@/lib/auth";
import { fireLevelUpConfetti } from "@/lib/confetti";
import { getSupabaseClient } from "@/lib/supabase";
import { toast } from "sonner";

type AnswerState = {
  selectedIndex: number | null;
  confirmed: boolean;
};

type AnswerRecord = {
  questionId: string;
  selectedIndex: number;
  isCorrect: boolean;
  skill: QuizQuestion["skill"];
};

function pct(n: number, d: number) {
  if (d === 0) return 0;
  return Math.round((n / d) * 100);
}

function arabicChoiceLabel(idx: number) {
  const letters = ["أ", "ب", "ت", "ث"];
  return letters[idx] || String(idx + 1);
}

function normalizeQuizQuestions(raw: any[]): QuizQuestion[] {
  return (raw || []).map((q: any, i: number) => {
    const options = Array.isArray(q.options) ? q.options.map(String) : [];
    return {
      id: String(q.id || `q_${i + 1}`),
      type: q.type === "tf" ? "tf" : "mcq",
      question: String(q.question || ""),
      options,
      correctIndex: Number(q.correctIndex ?? 0),
      explanation: String(q.explanation || q.rationale || ""),
      skill: q.skill === "التطبيق" ? ("التطبيق" as const) : ("الفهم" as const),
    } as QuizQuestion;
  });
}

export default function QuestionBankPage() {
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
  const fileName = React.useMemo(() => {
    const fromSession = sessionStorage.getItem("aass:last_uploaded_file_name") || "(ملف غير محدد)";
    return fromSession;
  }, []);

  const user = getCurrentUser();
  const cloud = cloudAuthEnabled();
  const sb = getSupabaseClient();

  const [loadingQuiz, setLoadingQuiz] = React.useState(true);
  const [quizId, setQuizId] = React.useState<string>("");
  const [quizTitle, setQuizTitle] = React.useState<string>("كويز سريع");
  const [quizQuestions, setQuizQuestions] = React.useState<QuizQuestion[] | null>(null);

  // ---------------------------------
  // Deep link support: fetch file name from DB when fileId comes from route
  // ---------------------------------
  React.useEffect(() => {
    if (!fileId) return;
    if (!user || !cloud || !sb) return;

    (async () => {
      try {
        const { data, error } = await sb
          .from("files")
          .select("name")
          .eq("user_id", user.id)
          .eq("id", fileId)
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error("FILE_NOT_FOUND");
        const name = String((data as any)?.name || "(ملف)");
        sessionStorage.setItem("aass:last_uploaded_file_name", name);
      } catch {
        toast.error("الرابط غير صالح أو الملف غير موجود");
        navigate("/مكتبتي");
      }
    })();
  }, [fileId, user?.id, cloud]);

  // ---------------------------------
  // Load latest quiz from DB (source of truth)
  // If none, generate & persist immediately.
  // ---------------------------------
  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoadingQuiz(true);

        // Cloud is the authoritative source
        if (!user || !cloud || !sb || !fileId) {
          // Fallback: mock (offline / not logged in)
          setQuizId("");
          setQuizTitle(fileName);
          setQuizQuestions(generateQuizMock(fileName, 8));
          return;
        }

        // 1) Fetch latest quiz row for this user+file
        const { data: last, error } = await sb
          .from("quizzes")
          .select("id,title,questions,created_at,score,total")
          .eq("user_id", user.id)
          .eq("file_id", fileId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && last && Array.isArray((last as any).questions) && (last as any).questions.length) {
          if (cancelled) return;
          setQuizId(String((last as any).id || ""));
          setQuizTitle(String((last as any).title || "كويز سريع"));
          setQuizQuestions(normalizeQuizQuestions((last as any).questions));
          return;
        }

        // 2) Generate new quiz via Edge Function and save immediately
        const { data: gen, error: ge } = await sb.functions.invoke("generate-study-content", {
          body: {
            action: "quiz_generate",
            fileId,
            title: `كويز: ${fileName}`.slice(0, 120),
            questionCount: 8,
          },
        });

        if (ge) throw ge;
        const qs = Array.isArray((gen as any)?.questions) ? (gen as any).questions : null;
        if (!qs || !qs.length) throw new Error("BAD_QUIZ_GENERATION");

        if (cancelled) return;
        setQuizId(String((gen as any)?.quizId || ""));
        setQuizTitle(String((gen as any)?.title || `كويز: ${fileName}`));
        setQuizQuestions(normalizeQuizQuestions(qs));
      } catch (e: any) {
        console.error(e);
        toast.error("تعذر تحميل بنك الأسئلة");
        // fallback: mock
        setQuizId("");
        setQuizTitle(fileName);
        setQuizQuestions(generateQuizMock(fileName, 8));
      } finally {
        if (!cancelled) setLoadingQuiz(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, cloud, fileId, fileName]);

  const questions = React.useMemo(() => {
    if (quizQuestions && quizQuestions.length) return quizQuestions;
    return generateQuizMock(fileName, 8);
  }, [quizQuestions, fileName]);

  const missingCloud = !user || !cloud || !sb || !fileId;

  const [step, setStep] = React.useState(0);
  const [mode, setMode] = React.useState<"quiz" | "results" | "review">("quiz");
  const [answer, setAnswer] = React.useState<AnswerState>({ selectedIndex: null, confirmed: false });
  const [explainLoading, setExplainLoading] = React.useState(false);
  const [explainText, setExplainText] = React.useState<string>("");
  const [records, setRecords] = React.useState<AnswerRecord[]>([]);

  const q = questions[Math.min(step, questions.length - 1)];
  const total = questions.length;
  const progressValue = Math.round(((step + 1) / total) * 100);

  const confirm = () => {
    if (answer.selectedIndex === null) return;
    if (answer.confirmed) return;

    const isCorrect = answer.selectedIndex === q.correctIndex;
    setExplainText("");
    setAnswer((prev) => ({ ...prev, confirmed: true }));
    setRecords((prev) => [
      ...prev,
      {
        questionId: q.id,
        selectedIndex: answer.selectedIndex!,
        isCorrect,
        skill: q.skill,
      },
    ]);

    if (isCorrect) {
      toast.success("إجابة صح! برافو عليك");
    } else {
      toast.error("إجابة غلط.. ولا يهمك، جرّب تاني أو اضغط (اشرح لي)");
    }

    // Track answered questions per user (for Dashboard)
    try {
      incrementAnsweredCount(getEffectiveUserId(), 1);
    } catch {
      // ignore
    }
  };

  const next = () => {
    if (!answer.confirmed) return;

    const nextStep = step + 1;
    if (nextStep >= total) {
      setMode("results");
      return;
    }
    setStep(nextStep);
    setAnswer({ selectedIndex: null, confirmed: false });
    setExplainText("");
  };

  const resetQuiz = async () => {
    setMode("quiz");
    setStep(0);
    setAnswer({ selectedIndex: null, confirmed: false });
    setRecords([]);
    setExplainText("");

    // Generate a fresh quiz (and persist) if cloud enabled
    if (!user || !cloud || !sb || !fileId) return;

    try {
      setLoadingQuiz(true);
      const { data: gen, error: ge } = await sb.functions.invoke("generate-study-content", {
        body: {
          action: "quiz_generate",
          fileId,
          title: `كويز: ${fileName}`.slice(0, 120),
          questionCount: 8,
        },
      });
      if (ge) throw ge;
      const qs = Array.isArray((gen as any)?.questions) ? (gen as any).questions : null;
      if (!qs || !qs.length) throw new Error("BAD_QUIZ_GENERATION");

      setQuizId(String((gen as any)?.quizId || ""));
      setQuizTitle(String((gen as any)?.title || `كويز: ${fileName}`));
      setQuizQuestions(normalizeQuizQuestions(qs));
    } catch (e) {
      console.error(e);
      toast.error("تعذر توليد كويز جديد");
    } finally {
      setLoadingQuiz(false);
    }
  };

  const score = records.filter((r) => r.isCorrect).length;

  // Submit results to DB when finishing (single-shot)
  const submittedRef = React.useRef(false);
  React.useEffect(() => {
    if (mode !== "results") return;
    if (submittedRef.current) return;
    submittedRef.current = true;

    (async () => {
      try {
        if (!user || !cloud || !sb || !fileId || !quizId) return;

        const answers = records.map((r) => ({ questionId: r.questionId, selectedIndex: r.selectedIndex }));

        const { data, error } = await sb.functions.invoke("generate-study-content", {
          body: { action: "quiz_submit", quizId, answers },
        });

        if (error) throw error;

        const pctScore = total ? score / total : 0;
        const passed80 = pctScore >= 0.8;

        if (passed80) {
          toast.success("مبروك! تم حفظ نتيجتك (+XP تلقائياً)");
          fireLevelUpConfetti();
        } else {
          toast.message("تم حفظ نتيجتك");
        }

        void data;
      } catch (e) {
        console.error(e);
        toast.error("تعذر حفظ نتيجة الكويز");
      }
    })();
  }, [mode, user?.id, cloud, fileId, quizId, records, score, total]);

  // Allow re-submit if user resets quiz
  React.useEffect(() => {
    submittedRef.current = false;
  }, [quizId]);

  const explainWrong = async () => {
    if (!answer.confirmed) return;
    if (answer.selectedIndex === null) return;
    if (answer.selectedIndex === q.correctIndex) return;

    if (!user || !cloud || !sb || !fileId) {
      toast.error("لازم تكون مسجل دخول والسحابة مفعلة");
      return;
    }

    setExplainLoading(true);
    setExplainText("");
    try {
      const chosen = q.options[answer.selectedIndex] || "";
      const correct = q.options[q.correctIndex] || "";

      const { data, error } = await sb.functions.invoke("generate-study-content", {
        body: {
          action: "explain_answer",
          fileId,
          question: q.question,
          chosen,
          correct,
          options: q.options,
        },
      });

      if (error) throw error;
      const text = String((data as any)?.text || "").trim();
      if (!text) throw new Error("BAD_EXPLAIN");

      setExplainText(text);
    } catch (e: any) {
      console.error(e);
      toast.error("فشل استخراج تفسير الذكاء الاصطناعي");
    } finally {
      setExplainLoading(false);
    }
  };

  const bySkill = {
    فهم: records.filter((r) => r.skill === "الفهم"),
    تطبيق: records.filter((r) => r.skill === "التطبيق"),
  };

  const understandingPct = pct(bySkill.فهم.filter((x) => x.isCorrect).length, bySkill.فهم.length);
  const applicationPct = pct(bySkill.تطبيق.filter((x) => x.isCorrect).length, bySkill.تطبيق.length);

  const pieData = [
    { name: "صحيح", value: score },
    { name: "خطأ", value: Math.max(0, total - score) },
  ];

  const radarData = [
    { skill: "الفهم", value: understandingPct || 0 },
    { skill: "التطبيق", value: applicationPct || 0 },
  ];

  const COLORS = ["var(--primary)", "oklch(0.62 0.12 27)"];

  if (loadingQuiz) {
    return (
      <AppShell>
        <section className="mx-auto w-full max-w-5xl space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl md:text-4xl font-extrabold">بنك الأسئلة التفاعلي</h1>
            <p className="text-muted-foreground leading-7">جاري تحميل آخر كويز محفوظ...</p>
          </div>
          <Card>
            <CardContent className="pt-6">
              <div className="h-40 grid place-items-center">
                <LoadingSpinner label="تحميل" />
              </div>
            </CardContent>
          </Card>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <section className="mx-auto w-full max-w-5xl space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl md:text-4xl font-extrabold">بنك الأسئلة التفاعلي</h1>
          <p className="text-muted-foreground leading-7">
            {missingCloud
              ? "وضع تجريبي (Offline) — سيتم استخدام أسئلة محاكية. لتفعيل بنك الأسئلة الحقيقي: سجّل دخولك وفعّل Supabase وارفع ملفاً."
              : `آخر كويز محفوظ: ${quizTitle}`}
          </p>
        </div>

        {!missingCloud && !quizId && (
          <Card>
            <CardContent className="pt-6 space-y-3">
              <div className="rounded-xl border bg-secondary/30 p-4">
                <div className="font-extrabold">تنبيه</div>
                <div className="text-sm text-muted-foreground leading-7 mt-1">
                  لم يتم العثور على كويز محفوظ بعد. إذا ظهر هذا التنبيه بشكل متكرر، تأكد من نشر Edge Function.
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {mode === "quiz" && (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="text-sm text-muted-foreground">
                  سؤال <span className="font-bold">{step + 1}</span> / {total}
                </div>
                <div className="w-56 max-w-full">
                  <Progress value={progressValue} />
                </div>
              </div>

              <Separator />

              <AnimatePresence mode="wait">
                <motion.div
                  key={q.id}
                  initial={{ opacity: 0, y: 12, scale: 0.99 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.99 }}
                  transition={{ type: "spring", stiffness: 240, damping: 22 }}
                >
                  <Card className="border bg-background">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-xl leading-8">{q.question}</CardTitle>
                      <div className="text-xs text-muted-foreground">
                        النوع: {q.type === "mcq" ? "اختيار من متعدد" : "صح/خطأ"} • المحور: {q.skill}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid gap-3">
                        {q.options.map((opt, idx) => {
                          const isSelected = answer.selectedIndex === idx;
                          const isCorrect = idx === q.correctIndex;
                          const showFeedback = answer.confirmed;

                          const feedbackClass = showFeedback
                            ? isCorrect
                              ? "border-green-500/35 bg-green-500/10"
                              : isSelected
                              ? "border-red-500/35 bg-red-500/10"
                              : ""
                            : isSelected
                            ? "border-primary/35 bg-primary/5"
                            : "";

                          return (
                            <motion.button
                              key={idx}
                              type="button"
                              disabled={answer.confirmed}
                              onClick={() => setAnswer({ selectedIndex: idx, confirmed: false })}
                              whileTap={{ scale: 0.98 }}
                              animate={
                                showFeedback && isSelected
                                  ? isCorrect
                                    ? { scale: [1, 1.03, 1] }
                                    : { x: [0, -6, 6, -4, 4, 0] }
                                  : undefined
                              }
                              transition={{ duration: 0.35 }}
                              className={cn(
                                "text-right w-full rounded-xl border p-4",
                                "transition",
                                "hover:bg-secondary/40",
                                "disabled:opacity-90 disabled:cursor-not-allowed",
                                feedbackClass
                              )}
                            >
                              <div className="flex items-start gap-3">
                                <div
                                  className={cn(
                                    "mt-0.5 size-6 rounded-full border grid place-items-center text-xs font-bold",
                                    isSelected ? "border-primary" : "border-border"
                                  )}
                                  aria-hidden="true"
                                >
                                  {arabicChoiceLabel(idx)}
                                </div>
                                <div className="flex-1 leading-7">{opt}</div>
                                {showFeedback && isCorrect && (
                                  <CheckCircle2 className="size-5 text-green-600 shrink-0" />
                                )}
                                {showFeedback && isSelected && !isCorrect && (
                                  <XCircle className="size-5 text-red-600 shrink-0" />
                                )}
                              </div>
                            </motion.button>
                          );
                        })}
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                        <Button onClick={confirm} disabled={answer.selectedIndex === null || answer.confirmed}>
                          تأكيد الإجابة
                        </Button>

                        {answer.confirmed && (
                          <div className="flex items-center gap-2">
                            {answer.selectedIndex !== null && answer.selectedIndex !== q.correctIndex && (
                              <Button variant="outline" onClick={explainWrong} disabled={explainLoading}>
                                {explainLoading ? "جاري الشرح..." : "اشرح لي"}
                              </Button>
                            )}

                            <Button variant="secondary" onClick={next}>
                              التالي
                            </Button>
                          </div>
                        )}
                      </div>

                      {answer.confirmed && (
                        <div className="mt-3 space-y-3">
                          <div className="rounded-xl border p-4 bg-secondary/30">
                            <div className="font-extrabold">لماذا هذه الإجابة؟</div>
                            <div className="text-sm text-muted-foreground leading-7 mt-1">{q.explanation}</div>
                          </div>

                          {explainText && (
                            <div className="rounded-xl border bg-background p-4">
                              <div className="font-extrabold mb-2">شرح الذكاء الاصطناعي (RAG)</div>
                              <div className="text-sm leading-7 whitespace-pre-wrap">{explainText}</div>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              </AnimatePresence>
            </CardContent>
          </Card>
        )}

        {mode === "results" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-2">
                <BarChart3 className="size-5" />
                لوحة النتائج
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <Card className="md:col-span-1">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">النتيجة النهائية</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-4xl font-extrabold">
                      {score}/{total}
                    </div>
                    <div className="text-sm text-muted-foreground mt-2">
                      {score >= Math.ceil(total * 0.8)
                        ? "ممتاز — مستواك قوي"
                        : score >= Math.ceil(total * 0.6)
                        ? "جيد جداً — تحتاج تثبيت بسيط"
                        : "ابدأ بمراجعة النقاط الأساسية ثم أعد الاختبار"}
                    </div>
                  </CardContent>
                </Card>

                <Card className="md:col-span-2">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">توزيع الإجابات</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <React.Suspense
                      fallback={
                        <div className="h-52 grid place-items-center">
                          <LoadingSpinner label="جاري تحميل الرسم..." />
                        </div>
                      }
                    >
                      <QuestionPieChart pieData={pieData} colors={COLORS} />
                    </React.Suspense>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">مستوى الطالب حسب المهارة</CardTitle>
                </CardHeader>
                <CardContent>
                  <React.Suspense
                    fallback={
                      <div className="h-72 grid place-items-center">
                        <LoadingSpinner label="جاري تحميل الرسم..." />
                      </div>
                    }
                  >
                    <QuestionRadarChart radarData={radarData} />
                  </React.Suspense>
                </CardContent>
              </Card>

              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button variant="outline" onClick={() => setMode("review")}>
                  مراجعة الأسئلة
                </Button>
                <Button className="gap-2" onClick={resetQuiz}>
                  <RotateCcw className="size-4" />
                  إعادة الاختبار
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => navigate(fileId ? `/explain/${fileId}` : "/شرح")}
                >
                  الرجوع للشرح AI
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {mode === "review" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">مراجعة الأسئلة</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {questions.map((qq, i) => {
                const rec = records.find((r) => r.questionId === qq.id);
                return (
                  <div key={qq.id} className="rounded-xl border p-4">
                    <div className="font-extrabold">
                      {i + 1}) {qq.question}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">المحور: {qq.skill}</div>

                    <div className="mt-3 grid gap-2">
                      {qq.options.map((opt, idx) => {
                        const isCorrect = idx === qq.correctIndex;
                        const isChosen = rec?.selectedIndex === idx;
                        return (
                          <div
                            key={idx}
                            className={cn(
                              "rounded-lg border px-3 py-2 text-sm",
                              isCorrect && "border-green-500/35 bg-green-500/10",
                              isChosen && !isCorrect && "border-red-500/35 bg-red-500/10"
                            )}
                          >
                            {opt}
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-3 rounded-xl border bg-secondary/30 p-3">
                      <div className="font-extrabold">لماذا هذه الإجابة؟</div>
                      <div className="text-sm text-muted-foreground leading-7 mt-1">{qq.explanation}</div>
                    </div>
                  </div>
                );
              })}

              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                <Button variant="outline" onClick={() => setMode("results")}>
                  العودة للنتائج
                </Button>
                <Button className="gap-2" onClick={resetQuiz}>
                  <RotateCcw className="size-4" />
                  إعادة الاختبار
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </section>
    </AppShell>
  );
}
