import * as React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import AdUnit from "@/components/ads/AdUnit";
import { ExplanationRenderer } from "@/components/explain/ExplanationRenderer";
import type { FileAnalysisMode } from "@/hooks/useFileAnalysis";

export interface ContentAreaProps {
  title?: string;
  mode: FileAnalysisMode;
  markdown: string;
  mdComponents: Record<string, any>;
}

function ContentSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-11/12" />
      <Skeleton className="h-4 w-10/12" />
      <Skeleton className="h-4 w-9/12" />
      <div className="pt-2">
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  );
}

export function ContentArea(props: ContentAreaProps) {
  return (
    <Card className="min-w-0">
      <CardHeader className="pb-3">
        <CardTitle className="text-xl">{props.title || "محتوى الشرح"}</CardTitle>
      </CardHeader>
      <CardContent>
        <article className="prose prose-zinc max-w-none dark:prose-invert">
          {props.mode === "loading" ? (
            <ContentSkeleton />
          ) : (
            <ExplanationRenderer markdown={props.markdown} components={props.mdComponents as any} />
          )}
        </article>

        {/* Ad slot ثابت احتياطي أسفل الشرح */}
        <div className="mt-6">
          <AdUnit slot={(import.meta.env.VITE_ADSENSE_SLOT_CONTENT || import.meta.env.VITE_ADSENSE_SLOT || "") as any} />
        </div>
      </CardContent>
    </Card>
  );
}
