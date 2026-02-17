/*
MermaidView (Lazy)
Design goal: render Mermaid mindmap safely with dynamic import to keep initial bundle small.
*/

import * as React from "react";
import { cn } from "@/lib/utils";

type Props = {
  code: string;
  className?: string;
};

export default function MermaidView(props: Props) {
  const { code, className } = props;
  const [svg, setSvg] = React.useState<string>("");
  const [err, setErr] = React.useState<string>("");

  React.useEffect(() => {
    let alive = true;

    async function run() {
      setErr("");
      setSvg("");
      const src = String(code || "").trim();
      if (!src) return;

      try {
        const mermaidMod = await import("mermaid");
        const mermaid = mermaidMod.default;

        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "default",
        });

        const id = `mm_${Math.random().toString(16).slice(2)}`;
        const out = await mermaid.render(id, src);
        if (!alive) return;
        setSvg(out.svg);
      } catch (e) {
        if (!alive) return;
        const msg = e instanceof Error ? e.message : "";
        setErr(msg || "تعذر عرض الخريطة الذهنية");
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [code]);

  if (!code.trim()) return null;

  return (
    <div className={cn("rounded-xl border bg-background p-3", className)}>
      {err ? (
        <div className="text-sm text-destructive leading-6">
          <div className="font-bold">تعذر عرض الخريطة</div>
          <div className="mt-1 opacity-90">{err}</div>
        </div>
      ) : !svg ? (
        <div className="text-sm text-muted-foreground">جاري رسم الخريطة...</div>
      ) : (
        <div
          className="mermaid-svg overflow-x-auto"
          // Mermaid returns sanitized SVG based on securityLevel=strict
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      )}
    </div>
  );
}
