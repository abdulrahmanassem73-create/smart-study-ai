import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function LoadingSpinner(props: {
  label?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass =
    props.size === "sm"
      ? "size-4"
      : props.size === "lg"
      ? "size-6"
      : "size-5";

  return (
    <div className={cn("flex items-center justify-center gap-2 text-sm text-muted-foreground", props.className)}>
      <Loader2 className={cn(sizeClass, "animate-spin")} />
      <span>{props.label || "جاري التحميل..."}</span>
    </div>
  );
}
