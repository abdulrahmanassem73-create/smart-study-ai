/*
Gemini Study Pack (via Supabase Edge Function)
- يأخذ نص المحاضرة (بعد الاستخراج)
- يرجّع:
  1) شرح/ملخص Markdown
  2) أسئلة MCQ بصيغة JSON

Security:
- لا يوجد أي API Key في المتصفح.
- الاتصال يتم عبر Supabase Edge Function: generate-study-content
*/

export type StudyPack = {
  analysis_markdown: string;
  questions: Array<{
    type: "mcq";
    skill: "الفهم" | "التطبيق";
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  }>;
};

import { getSupabaseClient } from "@/lib/supabase";

export function geminiEnabled() {
  // متاح فقط عندما تكون Functions متاحة (Supabase configured)
  return Boolean(getSupabaseClient());
}


export async function generateStudyPackFromText(params: {
  fileName: string;
  text: string;
  questionCount?: number;
}) {
  const sb = getSupabaseClient();
  if (!sb) {
    throw new Error("خطأ في الإعدادات: Supabase غير مُفعّل على السيرفر");
  }

  const qCount = Math.max(10, Math.min(25, Math.floor(params.questionCount ?? 10)));

  const { data, error } = await sb.functions.invoke("generate-study-content", {
    body: {
      action: "study_pack",
      text: params.text,
      questionCount: qCount,
    },
  });

  if (error) {
    // Security: لا نطبع تفاصيل قد تتضمن معلومات حساسة
    throw new Error("فشل الاتصال بمركز الذكاء الاصطناعي");
  }

  const parsed = data as StudyPack;

  if (!parsed?.analysis_markdown || !Array.isArray(parsed.questions)) {
    throw new Error("فشل الاتصال بمركز الذكاء الاصطناعي");
  }

  // تطبيع/تحقق خفيف
  type Q = StudyPack["questions"][number];
  const qs: Q[] = parsed.questions.slice(0, qCount).map((q: unknown) => {
    const obj = (q && typeof q === "object" ? (q as Record<string, unknown>) : {}) as Record<string, unknown>;
    const skillRaw = String(obj.skill || "");
    const optionsRaw = Array.isArray(obj.options) ? (obj.options as unknown[]) : [];

    return {
      type: "mcq",
      skill: skillRaw === "التطبيق" ? "التطبيق" : "الفهم",
      question: String(obj.question || "").trim(),
      options: optionsRaw.map((x) => String(x)),
      correctIndex: Math.max(0, Math.min(3, Number(obj.correctIndex ?? 0))),
      explanation: String(obj.explanation || "").trim(),
    };
  });

  return {
    analysis_markdown: String(parsed.analysis_markdown || "").trim(),
    questions: qs,
  } satisfies StudyPack;
}
