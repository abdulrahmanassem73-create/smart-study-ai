import * as React from "react";
import { toast } from "sonner";

import { analyzeWithGemini } from "@/lib/gemini-service";
import { geminiEnabled } from "@/lib/gemini-study-pack";
import { cloudAuthEnabled, getCurrentUser } from "@/lib/auth";
import { fetchAnalysisCloud, readAnalysis, saveAnalysisCloud } from "@/lib/library-store";
import { getSupabaseClient } from "@/lib/supabase";

export type FileAnalysisMode = "ready" | "missing-ai" | "loading" | "empty";

export interface UseFileAnalysisResult {
  fileId: string;
  fileName: string;
  markdown: string;
  mode: FileAnalysisMode;
  isLoading: boolean;
  copyExplainLink: () => Promise<void>;
}

function downloadTextFile(filename: string, content: string, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function buildDeepLink(path: string) {
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}#${path.startsWith("/") ? path : "/" + path}`;
}

export function useFileAnalysis(params: {
  fileIdFromRoute: string;
  onInvalidFile?: () => void;
}) {
  const fileId = React.useMemo(() => {
    const fromParam = String(params.fileIdFromRoute || "").trim();
    const fromSession = sessionStorage.getItem("aass:active_file_id") || "";
    const v = fromParam || fromSession;

    if (fromParam && fromParam !== fromSession) {
      sessionStorage.setItem("aass:active_file_id", fromParam);
    }

    return v;
  }, [params.fileIdFromRoute]);

  const [fileName, setFileName] = React.useState<string>(
    sessionStorage.getItem("aass:last_uploaded_file_name") || "(لم يتم تحديد ملف بعد)"
  );

  const [mode, setMode] = React.useState<FileAnalysisMode>("empty");
  const [markdown, setMarkdown] = React.useState<string>("");

  const isLoading = mode === "loading";

  // Fetch file metadata immediately from DB when coming from deep link
  React.useEffect(() => {
    if (!fileId) return;

    const u = getCurrentUser();
    const sb = getSupabaseClient();

    if (!u || !cloudAuthEnabled() || !sb) return;

    (async () => {
      try {
        const { data, error } = await sb
          .from("files")
          .select("id,name,content,analysis_markdown")
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

        const content = String((data as any).content || "");
        if (content.trim()) {
          sessionStorage.setItem(`aass:extracted:${fileId}`, content);
        }

        const md = String((data as any).analysis_markdown || "").trim();
        if (md) {
          setMarkdown(md);
          setMode("ready");
        }
      } catch (e: any) {
        console.error(e);
        toast.error("الرابط غير صالح أو الملف غير موجود");
        params.onInvalidFile?.();
      }
    })();
  }, [fileId]);

  // load analysis: local cache -> cloud -> AI (RAG)
  React.useEffect(() => {
    const user = getCurrentUser();

    if (!fileId) {
      setMode("empty");
      setMarkdown("# اختر ملفاً أولاً\n\nاذهب إلى **مكتبتي** واختر ملفاً ثم افتح صفحة الشرح.");
      return;
    }

    // 1) local cache
    if (user) {
      const cached = readAnalysis(user, fileId);
      if (cached?.markdown) {
        setMarkdown(cached.markdown);
        setMode("ready");
        fetchAnalysisCloud(user, fileId).then((cloudRes) => {
          if (cloudRes?.markdown) setMarkdown(cloudRes.markdown);
        });
        return;
      }
    }

    // 2) cloud
    if (user) {
      fetchAnalysisCloud(user, fileId).then((cloudRes) => {
        if (cloudRes?.markdown) {
          setMarkdown(cloudRes.markdown);
          setMode("ready");
          return;
        }
      });
    }

    // 3) AI
    if (!geminiEnabled()) {
      setMode("missing-ai");
      setMarkdown(
        "# الذكاء الاصطناعي غير مُفعل حالياً\n\nلا يمكن تشغيل التحليل لأن خدمة السيرفر غير جاهزة.\n\n- تأكد من نشر **Supabase Edge Function**: generate-study-content\n- وتأكد من ضبط Secret: **GEMINI_API_KEY** داخل Supabase\n"
      );
      return;
    }

    const extracted = sessionStorage.getItem(`aass:extracted:${fileId}`) || "";

    setMode("loading");
    analyzeWithGemini({ extractedText: extracted || undefined, fileId })
      .then((res) => {
        setMarkdown(res.markdown);
        setMode("ready");
        if (user) saveAnalysisCloud(user, fileId, res);
      })
      .catch(() => {
        setMode("empty");
        setMarkdown("# تعذر التحليل\n\nحاول مرة أخرى بعد دقائق.");
      });
  }, [fileId]);

  const copyExplainLink = React.useCallback(async () => {
    if (!fileId) return;
    const link = buildDeepLink(`/explain/${fileId}`);
    try {
      await navigator.clipboard.writeText(link);
      toast.success("تم نسخ رابط الشرح");
    } catch {
      downloadTextFile("explain-link.txt", link);
      toast.message("لم أستطع نسخ الرابط تلقائياً — تم تنزيل ملف به الرابط");
    }
  }, [fileId]);

  return {
    fileId,
    fileName,
    markdown,
    mode,
    isLoading,
    copyExplainLink,
  } satisfies UseFileAnalysisResult;
}
