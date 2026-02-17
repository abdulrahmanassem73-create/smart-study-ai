import * as React from "react";
import { useLocation, useParams } from "wouter";
import { Link as LinkIcon, Sparkles } from "lucide-react";

import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

import { useFileAnalysis } from "@/hooks/useFileAnalysis";
import { useMindMap } from "@/hooks/useMindMap";
import { useStudyChat } from "@/hooks/useStudyChat";

import { ChatPanel } from "@/components/explain/ChatPanel";
import { MindMapViewer } from "@/components/explain/MindMapViewer";
import { ContentArea } from "@/components/explain/ContentArea";
import AdUnit from "@/components/ads/AdUnit";

export default function ExplainPage() {
  const [, navigate] = useLocation();
  const params = useParams() as { fileId?: string };

  const fa = useFileAnalysis({
    fileIdFromRoute: String(params?.fileId || ""),
    onInvalidFile: () => navigate("/مكتبتي"),
  });

  const mindmap = useMindMap({ fileId: fa.fileId, fileName: fa.fileName, aiDisabled: fa.mode === "missing-ai" });

  const study_mode = (sessionStorage.getItem("aass:study_mode") || "balanced") as any;

  // Smart Suggestions based on markdown headings
  const suggestions = React.useMemo(() => {
    const base = [
      "هل تريد تلخيصاً لأهم النقاط؟",
      "اعمل لي أسئلة تدريب سريعة من الدرس",
      "اشرح لي هذه الفكرة ببساطة",
      "اذكر أهم التعريفات والقوانين",
    ];

    const headings = String(fa.markdown || "")
      .split("\n")
      .filter((l) => /^#{1,3}\s+/.test(l))
      .map((l) => l.replace(/^#{1,3}\s+/, "").trim())
      .filter((x) => x.length)
      .slice(0, 4);

    const topicQs = headings.map((h) => `اشرح لي قسم: ${h}`);
    return Array.from(new Set([...base, ...topicQs])).slice(0, 8);
  }, [fa.markdown]);

  const chat = useStudyChat({
    fileId: fa.fileId,
    pageMarkdown: fa.markdown,
    socraticMode: sessionStorage.getItem("aass:socratic_mode") === "1",
    study_mode,
  });

  // Inline Ad insertion between long paragraphs (best-effort)
  const mdComponents = React.useMemo(() => {
    let pCount = 0;
    let adCount = 0;
    const AD_EVERY = 5;
    const MAX_ADS = 2;

    return {
      p: (props: any) => {
        pCount += 1;
        const shouldAd = pCount % AD_EVERY === 0 && adCount < MAX_ADS;
        if (shouldAd) adCount += 1;

        return (
          <>
            <p {...props} />
            {shouldAd ? (
              <div className="my-5 not-prose">
                <AdUnit
                  slot={(import.meta.env.VITE_ADSENSE_SLOT_EXPLAIN || import.meta.env.VITE_ADSENSE_SLOT || "") as any}
                />
              </div>
            ) : null}
          </>
        );
      },
    };
  }, [fa.markdown]);

  return (
    <AppShell>
      <section className="mx-auto w-full max-w-6xl space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl md:text-4xl font-extrabold">صفحة الشرح</h1>
            <p className="text-muted-foreground leading-7">{fa.fileName}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="gap-2" onClick={fa.copyExplainLink} disabled={!fa.fileId}>
              <LinkIcon className="size-4" />
              نسخ رابط الشرح
            </Button>

            <ChatPanel
              open={chat.chatOpen}
              onToggle={() => chat.setChatOpen((v) => !v)}
              loading={chat.chatLoading}
              messages={chat.messages}
              draft={chat.draft}
              onDraftChange={chat.setDraft}
              onSend={chat.sendDraft}
              suggestions={suggestions}
              onPickSuggestion={(s) => {
                chat.setChatOpen(true);
                chat.setDraft(s);
              }}
            />

            <Button
              className="gap-2"
              onClick={() => navigate(fa.fileId ? `/بنك-الأسئلة/${fa.fileId}` : "/بنك-الأسئلة")}
              disabled={!fa.fileId}
            >
              <Sparkles className="size-4" />
              توليد اختبار سريع
            </Button>
          </div>
        </div>

        <Separator />

        <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
          <ContentArea mode={fa.mode} markdown={fa.markdown} mdComponents={mdComponents} />

          <aside className="space-y-5">
            <MindMapViewer
              fileId={fa.fileId}
              aiDisabled={fa.mode === "missing-ai"}
              mindmapCode={mindmap.mindmapCode}
              mindmapLoading={mindmap.mindmapLoading}
              onBuild={mindmap.buildMindMap}
              onCopyCode={mindmap.copyMindMapCode}
              onDownload={mindmap.downloadMindMap}
            />

            {/* إعلان إضافي ثابت في الشريط الجانبي */}
            <AdUnit slot={(import.meta.env.VITE_ADSENSE_SLOT_SIDEBAR || import.meta.env.VITE_ADSENSE_SLOT || "") as any} />
          </aside>
        </div>
      </section>
    </AppShell>
  );
}
