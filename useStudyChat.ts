import * as React from "react";
import { toast } from "sonner";

import { cloudAuthEnabled, getCurrentUser } from "@/lib/auth";
import { cloudFetchSummaries } from "@/lib/cloud-store";
import { getGlobalContextSummaries } from "@/lib/library-store";
import { chatWithGemini } from "@/lib/gemini-chat";
import { geminiEnabled } from "@/lib/gemini-study-pack";

export type ChatMsg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
};

function chatKey(params: { userId: string; fileId: string }) {
  return `aass:chat:${params.userId}:${params.fileId}`;
}

function safeParseMessages(raw: string | null): ChatMsg[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed
      .filter((m) => m && typeof m === "object")
      .map((m) => ({
        id: String((m as any).id || `m_${Math.random().toString(16).slice(2)}_${Date.now()}`),
        role: ((m as any).role === "user" ? "user" : "assistant") as ChatMsg["role"],
        content: String((m as any).content || ""),
        createdAt: Number((m as any).createdAt || Date.now()),
      }))
      .slice(-200);
  } catch {
    return null;
  }
}

export const DEFAULT_COMMANDS = {
  rescuer: [
    { label: "الزتونة", prompt: "الزتونة" },
    { label: "بسطها", prompt: "بسطها" },
    { label: "خريطة ذهنية", prompt: "خريطة ذهنية" },
  ],
  philosopher: [
    { label: "ليه بنذاكر ده؟", prompt: "ليه بنذاكر ده؟" },
    { label: "شبههالي", prompt: "شبههالي" },
    { label: "اربط بالواقع", prompt: "اربط بالواقع" },
    { label: "اربط بملف قديم", prompt: "اربط بملف قديم" },
  ],
  daheeh: [
    { label: "توقع فخ", prompt: "توقع فخ" },
    { label: "اسألني", prompt: "اسألني" },
    { label: "قوانين اللعبة", prompt: "قوانين اللعبة" },
  ],
} as const;

export function useStudyChat(params: {
  fileId: string;
  pageMarkdown: string;
  socraticMode: boolean;
  study_mode: any;
}) {
  const { fileId, pageMarkdown, socraticMode, study_mode } = params;

  const currentUser = getCurrentUser();
  const cloud = cloudAuthEnabled() && Boolean(currentUser?.id);
  const effectiveUserId = currentUser?.id || "guest";
  const effectiveFileId = fileId || "unknown";

  const defaultWelcome: ChatMsg[] = [
    {
      id: "m_welcome",
      role: "assistant",
      createdAt: Date.now(),
      content: "بص يا بطل — اسألني أي سؤال في الدرس وأنا هجاوبك من الكتاب نفسه.",
    },
  ];

  const [chatOpen, setChatOpen] = React.useState(false);
  const [chatLoading, setChatLoading] = React.useState(false);
  const [draft, setDraft] = React.useState("");

  const [messages, setMessages] = React.useState<ChatMsg[]>(() => {
    const saved = safeParseMessages(localStorage.getItem(chatKey({ userId: effectiveUserId, fileId: effectiveFileId })));
    return saved && saved.length ? saved : defaultWelcome;
  });

  // Persist chat
  React.useEffect(() => {
    try {
      localStorage.setItem(chatKey({ userId: effectiveUserId, fileId: effectiveFileId }), JSON.stringify(messages.slice(-200)));
    } catch {
      // ignore
    }
  }, [messages, effectiveUserId, effectiveFileId]);

  const pushMsg = React.useCallback((m: Omit<ChatMsg, "id" | "createdAt">) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `m_${Math.random().toString(16).slice(2)}_${Date.now()}`,
        createdAt: Date.now(),
        ...m,
      },
    ]);
  }, []);

  const runCommand = React.useCallback(
    async (commandLabel: string, userMessage?: string) => {
      if (!geminiEnabled()) {
        toast.error("الذكاء الاصطناعي غير مُفعل حالياً");
        return;
      }

      setChatLoading(true);
      try {
        pushMsg({ role: "user", content: userMessage || `/${commandLabel}` });

        const isCross = commandLabel === "اربط بملف قديم";

        const summaries =
          isCross && currentUser
            ? cloud
              ? (await cloudFetchSummaries(currentUser, { excludeFileId: fileId, maxFiles: 8 })).map((x) => ({ fileName: x.fileName, summary: x.summary }))
              : getGlobalContextSummaries({ user: currentUser, excludeFileId: fileId, perFileChars: 1500, maxFiles: 8 }).map((x) => ({ fileName: x.fileName, summary: x.summary }))
            : undefined;

        const reply = await chatWithGemini({
          socratic: socraticMode,
          commandLabel,
          userMessage,
          // في وضع RAG: لا نرسل Markdown الدرس لتقليل التكلفة
          pageMarkdown: fileId ? "" : pageMarkdown,
          fileId,
          globalSummaries: summaries,
          mode: isCross ? "cross-file" : "normal",
          study_mode,
        });

        pushMsg({ role: "assistant", content: reply });
      } catch {
        toast.error("فشل الاتصال بالذكاء الاصطناعي");
        pushMsg({ role: "assistant", content: "حصلت مشكلة بسيطة. جرّب تاني بعد ثواني." });
      } finally {
        setChatLoading(false);
      }
    },
    [cloud, currentUser, fileId, pageMarkdown, pushMsg, socraticMode, study_mode]
  );

  const sendDraft = React.useCallback(async () => {
    const t = draft.trim();
    if (!t) return;
    setDraft("");
    await runCommand("سؤال عام", t);
  }, [draft, runCommand]);

  return {
    chatOpen,
    setChatOpen,
    chatLoading,
    draft,
    setDraft,
    messages,
    runCommand,
    sendDraft,
  };
}
