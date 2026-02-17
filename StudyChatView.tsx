import * as React from "react";
import { Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { ChatMsg } from "@/hooks/useStudyChat";

export const StudyChatView = React.memo(function StudyChatView(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  loading: boolean;
  messages: ChatMsg[];
  draft: string;
  onDraftChange: (v: string) => void;
  onSend: () => void;
  suggestions?: string[];
  onPickSuggestion?: (s: string) => void;
}) {
  if (!props.open) return null;

  return (
    <Card className="border bg-background">
      <CardHeader className="pb-3 flex-row items-center justify-between">
        <CardTitle className="text-lg">المساعد الدراسي</CardTitle>
        <Button variant="outline" size="sm" onClick={() => props.onOpenChange(false)}>
          إغلاق
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <ScrollArea className="h-[340px] rounded-xl border bg-secondary/10 p-3">
          <div className="space-y-3">
            {props.messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "rounded-xl border p-3 text-sm leading-7",
                  m.role === "user" ? "bg-background" : "bg-primary/5 border-primary/20"
                )}
              >
                <div className="text-xs text-muted-foreground mb-1">
                  {m.role === "user" ? "أنت" : "Academic AI"}
                </div>
                <div className="whitespace-pre-wrap">{m.content}</div>
              </div>
            ))}
            {props.loading ? (
              <div className="text-sm text-muted-foreground">جاري الرد...</div>
            ) : null}
          </div>
        </ScrollArea>

        {Array.isArray(props.suggestions) && props.suggestions.length ? (
          <div className="flex flex-wrap gap-2">
            {props.suggestions.slice(0, 6).map((s) => (
              <button
                key={s}
                type="button"
                disabled={props.loading}
                onClick={() => props.onPickSuggestion?.(s)}
                className={cn(
                  "text-xs sm:text-sm",
                  "rounded-full border px-3 py-1",
                  "bg-secondary/20 hover:bg-secondary/35 transition",
                  "disabled:opacity-60 disabled:cursor-not-allowed"
                )}
              >
                {s}
              </button>
            ))}
          </div>
        ) : null}

        <div className="flex items-center gap-2">
          <Input
            value={props.draft}
            onChange={(e) => props.onDraftChange(e.target.value)}
            placeholder="اكتب سؤالك هنا..."
            disabled={props.loading}
            onKeyDown={(e) => {
              if (e.key === "Enter") props.onSend();
            }}
          />
          <Button className="gap-2" onClick={props.onSend} disabled={props.loading || !props.draft.trim()}>
            <Send className="size-4" />
            إرسال
          </Button>
        </div>

        <div className="text-xs text-muted-foreground">
          *ملاحظة: في وضع RAG، الرد يعتمد على الفقرات المسترجعة من الملف.*
        </div>
      </CardContent>
    </Card>
  );
});
