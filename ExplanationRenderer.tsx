import * as React from "react";

import { LoadingSpinner } from "@/components/LoadingSpinner";

const MarkdownView = React.lazy(() => import("@/components/markdown/MarkdownView"));

export const ExplanationRenderer = React.memo(function ExplanationRenderer(props: {
  markdown: string;
  components: any;
}) {
  return (
    <React.Suspense
      fallback={
        <div className="p-4">
          <LoadingSpinner label="جاري تحميل العارض..." size="sm" />
        </div>
      }
    >
      <MarkdownView markdown={props.markdown} components={props.components} />
    </React.Suspense>
  );
});
