/*
Gemini Service (via Supabase Edge Function)
- Converts extracted text => Markdown explanation + MCQ JSON

Security:
- No Gemini API key exists in the browser.
- All calls go through Supabase Edge Function: generate-study-content
*/

export type GeminiExplainResult = {
  markdown: string;
  questions: Array<{
    type: "mcq" | "tf";
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
    skill?: "الفهم" | "التطبيق";
  }>;
};

import { getSupabaseClient } from "@/lib/supabase";

export function geminiConfigured() {
  return Boolean(getSupabaseClient());
}

export async function analyzeWithGemini(params: { extractedText?: string; fileId?: string | null }) {
  const sb = getSupabaseClient();
  if (!sb) throw new Error("خطأ في الإعدادات: Supabase غير مُفعّل على السيرفر");

  const fileId = params.fileId || null;
  const extracted = params.extractedText || "";

  // Strategy:
  // 1) If fileId exists: try RAG-only first (text="") to reduce cost.
  // 2) If server replies that RAG is missing: retry with extracted text (fallback).
  const tryOnce = async (text: string) => {
    const { data, error } = await sb.functions.invoke("generate-study-content", {
      body: {
        action: "explain",
        text,
        fileId,
      },
    });
    return { data, error };
  };

  let res = await tryOnce(fileId ? "" : extracted);

  // Fallback if embeddings missing
  if (res.error) {
    const msg = String((res.error as any)?.message || "");
    if (fileId && extracted.trim() && (msg.includes("MISSING_TEXT_OR_RAG") || msg.includes("400"))) {
      res = await tryOnce(extracted);
    }
  }

  if (res.error) {
    throw new Error("فشل الاتصال بمركز الذكاء الاصطناعي");
  }

  const parsed = res.data as GeminiExplainResult;
  if (!parsed?.markdown || !Array.isArray(parsed.questions)) {
    throw new Error("فشل الاتصال بمركز الذكاء الاصطناعي");
  }

  return parsed;
}
