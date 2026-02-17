import * as React from "react";
import { motion } from "framer-motion";
import {
  CloudUpload,
  FileText,
  Image as ImageIcon,
  FileType2,
  Loader2,
  X,
} from "lucide-react";
import { useLocation } from "wouter";

import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  extractTextFromFile,
  prepareExtractEnginesForFile,
  type ExtractProgress,
} from "@/lib/text-extract";
import { cloudAuthEnabled, getCurrentUser } from "@/lib/auth";
import { saveExtractSummary, upsertLibraryItem } from "@/lib/library-store";
import { cloudUpsertFile } from "@/lib/cloud-store";
import { setSyncSnapshot } from "@/lib/sync-state";
import { awardUploadXpEveryTime } from "@/lib/user-stats";
import { fireLevelUpConfetti } from "@/lib/confetti";
import { uploadMaterialToCloud, uploadPdfToCloud } from "@/lib/cloud-storage";
import { getSupabaseClient } from "@/lib/supabase";
import { geminiEnabled, generateStudyPackFromText } from "@/lib/gemini-study-pack";
import { getOrCreateSettings, updateSettings } from "@/lib/user-settings";

type UploadStatus = "queued" | "extracting" | "done" | "error";

type UploadItem = {
  id: string;
  file: File;
  progress: number; // 0..100
  status: UploadStatus;
  stageLabel?: string;
  error?: string;
};

const ACCEPTED_MIME = new Set<string>([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  // Word موجود في الواجهة كنوع مدعوم للرفع، لكن استخراج النص الحقيقي منه يحتاج محرك إضافي
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

function fileIcon(file: File) {
  const t = file.type;
  if (t === "application/pdf") return FileText;
  if (t.startsWith("image/")) return ImageIcon;
  if (t.includes("word")) return FileType2;
  return FileType2;
}

function isSupported(file: File) {
  if (ACCEPTED_MIME.has(file.type)) return true;
  const name = file.name.toLowerCase();
  return (
    name.endsWith(".pdf") ||
    name.endsWith(".png") ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".webp") ||
    name.endsWith(".doc") ||
    name.endsWith(".docx")
  );
}

function canExtractNow(file: File) {
  const name = file.name.toLowerCase();
  const t = file.type;
  if (t === "application/pdf" || name.endsWith(".pdf")) return true;
  if (t.startsWith("image/") || /(\.png|\.jpg|\.jpeg|\.webp)$/.test(name)) return true;
  if (
    t === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".docx")
  )
    return true;
  return false;
}

function progressToPct(p: ExtractProgress) {
  return Math.max(0, Math.min(100, Math.round(p.progress01 * 100)));
}

export default function UploadPage() {
  const [, navigate] = useLocation();
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [items, setItems] = React.useState<UploadItem[]>([]);
  const [activeId, setActiveId] = React.useState<string | null>(null);

  const allDone =
    items.length > 0 &&
    items.every((x) => x.status === "done") &&
    items.every((x) => x.progress >= 100);

  const addFiles = React.useCallback((files: FileList | File[]) => {
    const arr = Array.from(files);
    const supported = arr.filter(isSupported);
    const rejected = arr.filter((f) => !isSupported(f));

    if (rejected.length) {
      toast.error("نوع الملف غير مدعوم. الرجاء رفع PDF أو صور أو Word فقط.");
    }
    if (!supported.length) return;

    const newItems: UploadItem[] = supported.map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(16).slice(2)}`,
      file,
      progress: 0,
      status: "queued",
      stageLabel: "في قائمة الانتظار",
    }));

    setItems((prev) => [...newItems, ...prev]);
  }, []);

  const onPickClick = () => inputRef.current?.click();

  const onInputChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    if (!e.target.files) return;
    addFiles(e.target.files);
    e.target.value = "";
  };

  const onDrop: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
    try {
      sessionStorage.removeItem(`aass:extracted:${id}`);
    } catch {
      // ignore
    }
  };

  // معالجة ملفات متعددة بالتتابع (one-by-one)
  React.useEffect(() => {
    if (activeId) return;
    const next = items.find((x) => x.status === "queued");
    if (!next) return;

    setActiveId(next.id);
    setItems((prev) =>
      prev.map((it) =>
        it.id === next.id
          ? { ...it, status: "extracting", stageLabel: "بدء استخراج النص" }
          : it
      )
    );

    (async () => {
      try {
        if (!canExtractNow(next.file)) {
          // Word: نسمح بالرفع لكن نوضح أن الاستخراج الحقيقي غير جاهز الآن
          throw new Error(
            "استخراج النص من Word غير مفعّل حالياً. ارفع PDF أو صورة لاستخراج النص الحقيقي."
          );
        }

        // 0) تحميل المحركات الثقيلة عند الحاجة (مرة واحدة) + UX spinner
        await prepareExtractEnginesForFile(next.file, (p) => {
          setItems((prev) =>
            prev.map((it) =>
              it.id === next.id
                ? {
                    ...it,
                    progress: Math.max(it.progress, Math.round(p.progress01 * 100)),
                    stageLabel:
                      p.stage === "loading"
                        ? "تحميل محركات التحليل..."
                        : it.stageLabel,
                  }
                : it
            )
          );
        });

        const text = await extractTextFromFile(next.file, (p) => {
          setItems((prev) =>
            prev.map((it) =>
              it.id === next.id
                ? {
                    ...it,
                    progress: progressToPct(p),
                    stageLabel:
                      p.stage === "loading"
                        ? "تحميل محركات التحليل..."
                        : p.stage === "reading"
                        ? "قراءة الملف"
                        : p.stage === "pdf"
                        ? "استخراج PDF"
                        : p.stage === "ocr"
                        ? "OCR للصورة"
                        : p.stage === "done"
                        ? "اكتمل"
                        : "...",
                  }
                : it
            )
          );
        });

        // تخزين النص المستخرج للاستخدام لاحقاً (شرح/اختبار) داخل الجلسة
        sessionStorage.setItem(`aass:extracted:${next.id}`, text);

        // تحديث قائمة الملفات (Session) + المكتبة الدائمة (Local) إن كان هناك مستخدم
        const meta = {
          id: next.id,
          name: next.file.name,
          size: next.file.size,
          type: next.file.type,
          extractedChars: text.length,
          uploadedAt: new Date().toISOString(),
        };
        const existing = sessionStorage.getItem("aass:files");
        const arr = existing ? (JSON.parse(existing) as any[]) : [];
        const merged = [meta, ...arr.filter((x) => x.id !== meta.id)];
        sessionStorage.setItem("aass:files", JSON.stringify(merged));

        const user = getCurrentUser();
        if (user) {
          upsertLibraryItem(user, {
            id: meta.id,
            fileName: meta.name,
            uploadedAt: meta.uploadedAt,
            extractedChars: meta.extractedChars,
            hasAnalysis: false,
          });

          // حفظ ملخص دائم (للذاكرة الشاملة Cross-File)
          const summary1500 = text.slice(0, 1500);
          saveExtractSummary(user, meta.id, summary1500);

          // Cloud upsert (لو Supabase مفعّل)
          if (cloudAuthEnabled()) {
            setSyncSnapshot({ status: "syncing", label: "رفع للسحابة..." });

            // 1) ارفع الملف الأصلي إلى Storage
            const isPdf = next.file.type === "application/pdf" || next.file.name.toLowerCase().endsWith(".pdf");
            const isDocx =
              next.file.type ===
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
              next.file.name.toLowerCase().endsWith(".docx");

            const materialUpload = isPdf
              ? uploadPdfToCloud({ user, fileId: meta.id, file: next.file })
              : isDocx
              ? uploadMaterialToCloud({ user, fileId: meta.id, file: next.file })
              : Promise.resolve(null);

            materialUpload
              .then((pdfRes) =>
                cloudUpsertFile(user, {
                  id: meta.id,
                  name: meta.name,
                  content: text,
                  summary: summary1500,
                  pdf_path: pdfRes?.path || "",
                  file_size_bytes: meta.size,
                })
              )
              .then(async () => {
                setSyncSnapshot({ status: "synced", label: "Cloud" });

                // 2) تحليل AI + توليد 5 MCQ + حفظها سحابياً
                if (geminiEnabled()) {
                  const sb = getSupabaseClient();
                  const u = getCurrentUser();
                  if (sb && u) {
                    try {
                      setSyncSnapshot({ status: "syncing", label: "AI..." });
                      toast.message("جاري تحليل المحاضرة بالذكاء الاصطناعي...");

                      const settings = await getOrCreateSettings(u);
                      const useTicket = Number(settings.golden_tickets || 0) > 0;
                      const questionCount = 10 + (useTicket ? 5 : 0);

                      // 0) Index embeddings (RAG) — best effort
                      try {
                        await sb.functions.invoke("generate-study-content", {
                          body: { action: "index_file", fileId: meta.id, text },
                        });
                      } catch {
                        // ignore
                      }

                      const pack = await generateStudyPackFromText({
                        fileName: meta.name,
                        text,
                        questionCount,
                      });

                      if (useTicket) {
                        // استهلاك تذكرة واحدة
                        await updateSettings(u, {
                          golden_tickets: Math.max(0, Number(settings.golden_tickets || 0) - 1),
                        });
                      }

                      // تحديث ملف المكتبة بأنه أصبح لديه تحليل
                      upsertLibraryItem(u, {
                        id: meta.id,
                        fileName: meta.name,
                        uploadedAt: meta.uploadedAt,
                        extractedChars: meta.extractedChars,
                        hasAnalysis: true,
                      });

                      await sb
                        .from("files")
                        .update({
                          analysis_markdown: pack.analysis_markdown,
                          analysis_questions: pack.questions as any,
                        })
                        .eq("user_id", u.id)
                        .eq("id", meta.id);

                      await sb.from("quizzes").insert({
                        id: `quiz_${meta.id}_${Date.now()}`,
                        user_id: u.id,
                        file_id: meta.id,
                        title: `Quiz: ${meta.name}`,
                        questions: pack.questions as any,
                      });

                      // تخزين سريع للاستخدام الفوري في QuestionBank
                      sessionStorage.setItem(
                        `aass:analysis:${meta.id}`,
                        JSON.stringify({ questions: pack.questions })
                      );

                      setSyncSnapshot({ status: "synced", label: "Live" });
                      toast.success("تم تجهيز الشرح و 5 أسئلة تلقائياً!");
                    } catch (e: any) {
                      console.error(e);
                      setSyncSnapshot({ status: "synced", label: "Cloud" });
                      toast.error("تم رفع الملف بنجاح، لكن فشل الاتصال بمركز الذكاء الاصطناعي");
                    }
                  }
                }

                // Notification: big file uploaded
                if (meta.size > 8 * 1024 * 1024) {
                  const sb = getSupabaseClient();
                  const u = getCurrentUser();
                  if (sb && u) {
                    (async () => {
                      try {
                        await sb.from("notifications").insert({
                          id: `n_big_${meta.id}_${Date.now()}`,
                          user_id: u.id,
                          title: "تم رفع ملف كبير بنجاح",
                          message: `تم تأمين ملف ${meta.name} على السحابة.`,
                          type: "success",
                          is_read: false,
                        });
                      } catch {
                        // ignore
                      }
                    })();
                  }
                }
              })
              .catch((e) => {
                console.error(e);
                setSyncSnapshot({ status: "error", label: "خطأ سحابة" });

                // Notification: sync error
                const sb = getSupabaseClient();
                const u = getCurrentUser();
                if (sb && u) {
                  (async () => {
                    try {
                      await sb.from("notifications").insert({
                        id: `n_syncerr_${meta.id}_${Date.now()}`,
                        user_id: u.id,
                        title: "خطأ في المزامنة",
                        message: `تعذر رفع الملف للسحابة: ${meta.name}`,
                        type: "error",
                        is_read: false,
                      });
                    } catch {
                      // ignore
                    }
                  })();
                }
              });
          }
        }

        setItems((prev) =>
          prev.map((it) =>
            it.id === next.id
              ? {
                  ...it,
                  status: "done",
                  progress: 100,
                  stageLabel: `تم استخراج النص (${text.length.toLocaleString()} حرف)`,
                }
              : it
          )
        );

        toast.success("تم استخراج النص بنجاح، جاهز للتحليل!");

        // Notifications (cloud)
        if (cloudAuthEnabled()) {
          const sb = getSupabaseClient();
          const u = getCurrentUser();
          if (sb && u) {
            (async () => {
              try {
                await sb.from("notifications").insert({
                  id: `n_extract_${meta.id}_${Date.now()}`,
                  user_id: u.id,
                  title: "اكتمل استخراج النص",
                  message: `تم تجهيز الملف: ${meta.name}`,
                  type: "success",
                  is_read: false,
                });
              } catch {
                // ignore
              }
            })();
          }
        }

        // XP: +20 عند كل رفع ملف
        const userForXp = getCurrentUser();
        if (userForXp && cloudAuthEnabled()) {
          awardUploadXpEveryTime(userForXp)
            .then((r) => {
              if (r.leveledUp) fireLevelUpConfetti();
            })
            .catch(() => {});
        }
      } catch (e: any) {
        const msg = e?.message || "فشل استخراج النص";
        setItems((prev) =>
          prev.map((it) =>
            it.id === next.id
              ? {
                  ...it,
                  status: "error",
                  progress: 100,
                  stageLabel: "فشل",
                  error: msg,
                }
              : it
          )
        );
        toast.error(msg);
      } finally {
        setActiveId(null);
      }
    })();
  }, [items, activeId]);

  return (
    <AppShell>
      <section className="mx-auto w-full max-w-5xl space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl md:text-4xl font-extrabold">رفع ومعالجة الملفات</h1>
          <p className="text-muted-foreground leading-7">
            الآن نقوم باستخراج النص الحقيقي من الملفات داخل المتصفح (PDF/صور). ثم سنستخدمه
            للتحليل بالذكاء الاصطناعي.
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <motion.div
              role="button"
              tabIndex={0}
              onClick={onPickClick}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onPickClick();
              }}
              onDragEnter={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setIsDragging(false);
              }}
              onDrop={onDrop}
              animate={isDragging ? { scale: 1.01 } : { scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className={cn(
                "relative",
                "cursor-pointer select-none",
                "rounded-2xl border border-dashed",
                "bg-secondary/40",
                "p-10 md:p-14",
                "text-center",
                "outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isDragging && "border-primary/60 bg-primary/5"
              )}
            >
              <motion.div
                initial={false}
                animate={isDragging ? { y: -4 } : { y: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 18 }}
                className="mx-auto flex max-w-xl flex-col items-center gap-3"
              >
                <CloudUpload className="size-14" style={{ color: "var(--primary)" }} />
                <div className="text-lg font-bold leading-7">
                  اسحب ملفات المحاضرات هنا (PDF, Images, Word) أو اضغط للاختيار
                </div>
                <div className="text-sm text-muted-foreground">
                  استخراج النص الحقيقي متاح حالياً لـ PDF والصور. (Word سنضيفه لاحقاً)
                </div>
              </motion.div>

              {isDragging && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 rounded-2xl ring-2 ring-primary/30"
                />
              )}
            </motion.div>

            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,application/pdf,image/*,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={onInputChange}
            />
          </CardContent>
        </Card>

        {items.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-xl">الملفات المرفوعة</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                <div className="space-y-3">
                  {items.map((it) => {
                    const Icon = fileIcon(it.file);
                    const isActive = activeId === it.id;
                    return (
                      <div
                        key={it.id}
                        className={cn(
                          "rounded-xl border p-4",
                          "bg-background",
                          "flex items-start gap-4",
                          it.status === "error" && "border-red-500/30"
                        )}
                      >
                        <div className="size-10 rounded-xl bg-secondary grid place-items-center">
                          <Icon className="size-5" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-semibold truncate">{it.file.name}</div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {formatBytes(it.file.size)} • {it.file.type || "نوع غير معروف"}
                              </div>
                            </div>

                            <Button
                              variant="ghost"
                              size="icon"
                              className="shrink-0"
                              onClick={() => removeItem(it.id)}
                              aria-label="حذف الملف"
                              title="حذف الملف"
                            >
                              <X className="size-4" />
                            </Button>
                          </div>

                          <div className="mt-3 space-y-2">
                            <Progress value={it.progress} />
                            <div className="text-xs text-muted-foreground flex items-center gap-2">
                              {isActive && <Loader2 className="size-3 animate-spin" />}
                              <span>
                                {it.stageLabel ||
                                  (it.status === "queued"
                                    ? "في قائمة الانتظار"
                                    : it.status === "extracting"
                                    ? "جارٍ الاستخراج..."
                                    : it.status === "done"
                                    ? "اكتمل"
                                    : "فشل")}
                              </span>
                              {it.error && <span className="text-red-600">— {it.error}</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>

              {allDone && (
                <div className="pt-6 flex flex-col items-center gap-3">
                  <div className="text-sm text-muted-foreground">
                    تم استخراج النص من كل الملفات. الخطوة التالية: التحليل بالذكاء الاصطناعي.
                  </div>
                  <Button
                    size="lg"
                    className="text-base px-7"
                    onClick={() => {
                      // اجعل أحدث ملف هو النشط افتراضياً
                      const first = items[0];
                      if (first) {
                        sessionStorage.setItem("aass:active_file_id", first.id);
                        sessionStorage.setItem("aass:last_uploaded_file_name", first.file.name);
                      }
                      const fid = sessionStorage.getItem("aass:active_file_id") || "";
                      navigate(fid ? `/explain/${fid}` : "/شرح");
                    }}
                  >
                    بدء تحليل المادة العلمية بالذكاء الاصطناعي 🚀
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </section>
    </AppShell>
  );
}
