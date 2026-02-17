import * as React from "react";
import { toast } from "sonner";

import { getSupabaseClient } from "@/lib/supabase";
import { generateMindMap } from "@/lib/gemini-chat";
import { geminiEnabled } from "@/lib/gemini-study-pack";

export function useMindMap(params: {
  fileId: string;
  fileName: string;
  aiDisabled?: boolean;
}) {
  const { fileId, fileName, aiDisabled } = params;

  const [mindmapCode, setMindmapCode] = React.useState<string>("");
  const [mindmapLoading, setMindmapLoading] = React.useState(false);

  // Load from session cache + DB cache
  React.useEffect(() => {
    if (!fileId) {
      setMindmapCode("");
      return;
    }

    const k = `aass:mindmap:${fileId}`;
    const local = sessionStorage.getItem(k) || "";
    if (local.trim()) setMindmapCode(local);

    const sb = getSupabaseClient();
    if (!sb) return;

    (async () => {
      try {
        const { data } = await sb.from("files").select("mindmap_code").eq("id", fileId).maybeSingle();
        const db = String((data as any)?.mindmap_code || "").trim();
        if (db) {
          setMindmapCode(db);
          sessionStorage.setItem(k, db);
        }
      } catch {
        // ignore
      }
    })();
  }, [fileId]);

  const buildMindMap = React.useCallback(
    async (opts?: { refresh?: boolean }) => {
      if (!fileId) {
        toast.error("لا يوجد ملف نشط لتوليد خريطة");
        return;
      }

      const extracted = sessionStorage.getItem(`aass:extracted:${fileId}`) || "";
      if (!extracted.trim()) {
        toast.error("لا يوجد نص مستخرج لهذا الملف بعد");
        return;
      }

      if (!geminiEnabled() || aiDisabled) {
        toast.error("الذكاء الاصطناعي غير مُفعل حالياً");
        return;
      }

      setMindmapLoading(true);
      try {
        const mermaid = await generateMindMap({
          text: extracted,
          fileId,
          refresh: Boolean(opts?.refresh),
        });
        setMindmapCode(mermaid);
        sessionStorage.setItem(`aass:mindmap:${fileId}`, mermaid);
        toast.success(opts?.refresh ? "تم تحديث الخريطة الذهنية" : "تم توليد الخريطة الذهنية");
      } catch {
        toast.error(opts?.refresh ? "فشل تحديث الخريطة الذهنية" : "فشل توليد الخريطة الذهنية");
      } finally {
        setMindmapLoading(false);
      }
    },
    [fileId, aiDisabled]
  );

  const copyMindMapCode = React.useCallback(async () => {
    if (!mindmapCode.trim()) return;
    try {
      await navigator.clipboard.writeText(mindmapCode);
      toast.success("تم نسخ كود الخريطة");
    } catch {
      toast.error("تعذر النسخ");
    }
  }, [mindmapCode]);

  const downloadMindMap = React.useCallback(() => {
    if (!mindmapCode.trim()) return;
    const safe = fileName.replace(/[\\/:*?"<>|]+/g, "-");
    const blob = new Blob([mindmapCode], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `خريطة-${safe}.mmd`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("تم تحميل ملف Mermaid");
  }, [mindmapCode, fileName]);

  return {
    mindmapCode,
    mindmapLoading,
    buildMindMap,
    copyMindMapCode,
    downloadMindMap,
  };
}
