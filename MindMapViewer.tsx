import * as React from "react";
import { Copy, FileDown, RefreshCw, Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";


const LazyMindMap = React.lazy(() => import("@/components/mermaid/StudyMindMap"));

export interface MindMapViewerProps {
  fileId: string;
  aiDisabled: boolean;
  mindmapCode: string;
  mindmapLoading: boolean;
  onBuild: (opts?: { refresh?: boolean }) => void;
  onCopyCode: () => void;
  onDownload: () => void;
}

export function MindMapViewer(props: MindMapViewerProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">الخريطة الذهنية</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2">
          <Button
            className="w-full gap-2"
            variant={props.mindmapCode ? "secondary" : "default"}
            onClick={() => props.onBuild()}
            disabled={props.mindmapLoading || props.aiDisabled || !props.fileId}
          >
            <Wand2 className="size-4" />
            {props.mindmapLoading
              ? "جاري التوليد..."
              : props.mindmapCode
                ? "إظهار/إعادة تحميل"
                : "توليد خريطة ذهنية"}
          </Button>

          {props.mindmapCode ? (
            <Button
              className="w-full gap-2"
              variant="default"
              onClick={() => props.onBuild({ refresh: true })}
              disabled={props.mindmapLoading || props.aiDisabled || !props.fileId}
            >
              <RefreshCw className="size-4" />
              تحديث الخريطة
            </Button>
          ) : null}
        </div>

        {props.mindmapCode ? (
          <div className="grid gap-2">
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="w-full gap-2" onClick={props.onCopyCode}>
                <Copy className="size-4" />
                نسخ الكود
              </Button>
              <Button size="sm" variant="outline" className="w-full gap-2" onClick={props.onDownload}>
                <FileDown className="size-4" />
                تحميل
              </Button>
            </div>

            <React.Suspense fallback={<div className="text-sm text-muted-foreground">جاري تحميل العارض...</div>}>
              <LazyMindMap code={props.mindmapCode} />
            </React.Suspense>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground leading-6">
            اضغط على زر التوليد لاستخراج هيكل الدرس في صورة Mind Map.
          </div>
        )}

      </CardContent>
    </Card>
  );
}
