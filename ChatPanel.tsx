import * as React from "react";
import { MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StudyChatView } from "@/components/explain/StudyChatView";
import type { ChatMsg } from "@/hooks/useStudyChat";

export interface ChatPanelProps {
  open: boolean;
  onToggle: () => void;
  loading: boolean;
  messages: ChatMsg[];
  draft: string;
  onDraftChange: (v: string) => void;
  onSend: () => void;
  suggestions: string[];
  onPickSuggestion: (s: string) => void;
}

export function ChatPanel(props: ChatPanelProps) {
  return (
    <>
      <Button variant="outline" className="gap-2" onClick={props.onToggle}>
        <MessageCircle className="size-4" />
        {props.open ? "إغلاق الشات" : "فتح الشات"}
      </Button>

      <StudyChatView
        open={props.open}
        onOpenChange={(v) => {
          if (!v) props.onToggle();
        }}
        loading={props.loading}
        messages={props.messages}
        draft={props.draft}
        onDraftChange={props.onDraftChange}
        onSend={props.onSend}
        suggestions={props.suggestions}
        onPickSuggestion={props.onPickSuggestion}
      />
    </>
  );
}
