/*
Gemini Chat Service (via Supabase Edge Function)
- Output: Markdown فقط

Security:
- لا يوجد API key في المتصفح.
- الـ prompt/persona يتم بناؤه في السيرفر داخل Edge Function.
*/

import { getSupabaseClient } from "@/lib/supabase";


export type StudyMode = "simple" | "balanced" | "deep_dive" | "exam_prep";

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

export async function chatWithGemini(params: {
  commandLabel: string;
  userMessage?: string;
  pageMarkdown?: string;
  fileId?: string | null;
  globalSummaries?: Array<{ fileName: string; summary: string }>;
  mode?: "normal" | "cross-file";
  socratic?: boolean;
  study_mode?: StudyMode;
}) {
  const sb = getSupabaseClient();
  if (!sb) throw new Error("خطأ في الإعدادات: Supabase غير مُفعّل على السيرفر");

  const { data, error } = await sb.functions.invoke("generate-study-content", {
    body: {
      action: "chat",
      commandLabel: params.commandLabel,
      userMessage: params.userMessage,
      pageMarkdown: params.pageMarkdown || "",
      fileId: params.fileId || null,
      globalSummaries: params.globalSummaries,
      mode: params.mode || "normal",
      socratic: Boolean(params.socratic),
      study_mode: params.study_mode || "balanced",
    },
  });

  if (error) {
    throw new Error("فشل الاتصال بمركز الذكاء الاصطناعي");
  }

  const obj = (data as Record<string, unknown>) || {};
  const answer = String(obj.answer || "").trim();
  const confidence = Number(obj.confidence_score ?? NaN);
  const summary = String(obj.reasoning_summary || "").trim();

  if (!answer) throw new Error("فشل الاتصال بمركز الذكاء الاصطناعي");

  const confidenceLine = Number.isFinite(confidence)
    ? `\n\n> نسبة الثقة: **${Math.round(Math.max(0, Math.min(1, confidence)) * 100)}%**`
    : "";

  const summaryLine = summary ? `\n\n> 💡 دليل من الملف: ${summary}` : "";

  return `${answer}${summaryLine}${confidenceLine}`.trim();
}

export async function generateMindMap(params: {
  text?: string;
  fileId?: string | null;
  chunks?: string[];
  refresh?: boolean;
}) {

  const sb = getSupabaseClient();
  if (!sb) throw new Error("خطأ في الإعدادات: Supabase غير مُفعّل على السيرفر");

  const { data, error } = await sb.functions.invoke("generate-study-content", {
    body: {
      action: "mindmap",
      text: params.text || "",
      chunks: Array.isArray(params.chunks) ? params.chunks : undefined,
      fileId: params.fileId || null,
      refresh: Boolean(params.refresh),
    },
  });

  if (error) throw new Error("فشل توليد الخريطة الذهنية");

  const obj = (data as Record<string, unknown>) || {};
  const mermaid = String(obj.mermaid || "").trim();
  if (!mermaid) throw new Error("فشل توليد الخريطة الذهنية");

  return mermaid;
}

export type ExamQuestion = {
  id: string;
  level: "direct" | "link" | "critical";
  topic: string;
  question: string;
  options: string[];
  correctIndex: number;
  rationale?: string;
  source_hint?: string;
};

export async function generateExam(params: {
  fileId?: string | null;
  title?: string;
  questionCount?: number;
  durationSec?: number;
}) {
  const sb = getSupabaseClient();
  if (!sb) throw new Error("خطأ في الإعدادات: Supabase غير مُفعّل على السيرفر");

  const { data, error } = await sb.functions.invoke("generate-study-content", {
    body: {
      action: "exam_generate",
      fileId: params.fileId || null,
      title: params.title || "امتحان تجريبي",
      questionCount: params.questionCount ?? 15,
      durationSec: params.durationSec ?? 1800,
    },
  });

  if (error) throw new Error("فشل توليد الامتحان");
  const obj = (data as any) || {};
  const questions = Array.isArray(obj.questions) ? (obj.questions as ExamQuestion[]) : [];
  if (!obj.examId || !questions.length) throw new Error("فشل توليد الامتحان");

  return {
    examId: String(obj.examId),
    title: String(obj.title || "امتحان تجريبي"),
    durationSec: Number(obj.durationSec || 1800),
    blueprint: obj.blueprint || {},
    questions,
  };
}

export async function submitExam(params: {
  examId: string;
  fileId?: string | null;
  answers: Array<{ id: string; selectedIndex: number | null }>;
}) {
  const sb = getSupabaseClient();
  if (!sb) throw new Error("خطأ في الإعدادات: Supabase غير مُفعّل على السيرفر");

  const { data, error } = await sb.functions.invoke("generate-study-content", {
    body: {
      action: "exam_submit",
      examId: params.examId,
      fileId: params.fileId || null,
      answers: params.answers,
    },
  });

  if (error) throw new Error("فشل تصحيح الامتحان");

  const obj = (data as any) || {};
  return {
    attemptId: String(obj.attemptId || ""),
    score: Number(obj.score || 0),
    total: Number(obj.total || 0),
    report_markdown: String(obj.report_markdown || "").trim(),
    wrong_items: Array.isArray(obj.wrong_items) ? obj.wrong_items : [],
    study_plan: Array.isArray(obj.study_plan) ? obj.study_plan : [],
    weak_topics: Array.isArray(obj.weak_topics) ? obj.weak_topics : [],
  };
}
