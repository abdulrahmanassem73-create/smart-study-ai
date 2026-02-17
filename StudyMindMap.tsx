/*
StudyMindMap
- Mermaid mindmap renderer with Zoom/Pan for mobile readability.
- Mermaid init requested: startOnLoad:true, theme:'forest'.
*/

import * as React from "react";
import mermaid from "mermaid";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";

export type StudyMindMapProps = {
  code: string;
  className?: string;
};

function normalize(code: string) {
  const s = String(code || "").trim();
  if (!s) return "";
  // strip fences just in case
  return s.replace(/^```\w*\s*/i, "").replace(/```\s*$/i, "").trim();
}

const StudyMindMap = React.memo(function StudyMindMap(props: StudyMindMapProps) {
  const hostRef = React.useRef<HTMLDivElement | null>(null);
  const [err, setErr] = React.useState("");

  React.useEffect(() => {
    mermaid.initialize({
      startOnLoad: true,
      theme: "forest",
      securityLevel: "strict",
    });
  }, []);

  React.useEffect(() => {
    let alive = true;

    async function render() {
      setErr("");
      const src = normalize(props.code);
      if (!src) return;
      if (!hostRef.current) return;

      try {
        const id = `mindmap_${Math.random().toString(16).slice(2)}`;
        const out = await mermaid.render(id, src);
        if (!alive) return;
        hostRef.current.innerHTML = out.svg;
      } catch (e) {
        if (!alive) return;
        hostRef.current.innerHTML = "";
        setErr(e instanceof Error ? e.message : "تعذر رسم الخريطة");
      }
    }

    render();
    return () => {
      alive = false;
    };
  }, [props.code]);

  const hasCode = normalize(props.code).length > 0;
  if (!hasCode) return null;

  return (
    <div className={props.className}>
      {err ? (
        <div className="text-sm text-destructive leading-6">
          <div className="font-bold">تعذر عرض الخريطة</div>
          <div className="mt-1 opacity-90">{err}</div>
        </div>
      ) : (
        <TransformWrapper
          minScale={0.6}
          initialScale={0.9}
          limitToBounds={false}
          centerOnInit
          doubleClick={{ mode: "zoomIn" }}
          wheel={{ step: 0.08 }}
          pinch={{ step: 4 }}
          panning={{ velocityDisabled: true }}
        >
          <TransformComponent wrapperClass="w-full" contentClass="w-full">
            <div
              ref={hostRef}
              className="w-full overflow-x-auto [&_svg]:max-w-none [&_svg]:h-auto"
            />
          </TransformComponent>
        </TransformWrapper>
      )}
    </div>
  );
});

export default StudyMindMap;
