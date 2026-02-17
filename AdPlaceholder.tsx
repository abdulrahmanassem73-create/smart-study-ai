/*
AdPlaceholder
- Placeholder slots تمهيداً لربط Google AdSense.
- الإظهار/الإخفاء يتحكم به user_settings.ads_enabled.
*/

import * as React from "react";
import { cn } from "@/lib/utils";
import { getCurrentUser } from "@/lib/auth";
import { getCachedSettings } from "@/lib/user-settings";

export default function AdPlaceholder(props: {
  className?: string;
  label?: string;
}) {
  const label = props.label || "مساحة إعلانية";

  const [enabled, setEnabled] = React.useState(() => {
    const u = getCurrentUser();
    if (!u) return true; // Guest: show placeholders
    const s = getCachedSettings(u.id) as any;
    // default: enabled
    if (typeof s?.ads_enabled === "boolean") return s.ads_enabled;
    return true;
  });

  React.useEffect(() => {
    const onSettings = (e: Event) => {
      const u = getCurrentUser();
      if (!u) return setEnabled(true);
      const detail = (e as CustomEvent<any>)?.detail;
      if (detail && typeof detail.ads_enabled === "boolean") {
        setEnabled(Boolean(detail.ads_enabled));
        return;
      }
      const s = getCachedSettings(u.id) as any;
      setEnabled(typeof s?.ads_enabled === "boolean" ? Boolean(s.ads_enabled) : true);
    };

    window.addEventListener("aass:settings_updated", onSettings as any);
    return () => window.removeEventListener("aass:settings_updated", onSettings as any);
  }, []);

  if (!enabled) return null;

  return (
    <div
      className={cn(
        "w-full",
        "rounded-xl border border-dashed",
        "bg-muted/40 text-muted-foreground",
        "grid place-items-center",
        "min-h-[90px] sm:min-h-[110px]",
        "px-4 py-4",
        props.className
      )}
      aria-label={label}
      role="note"
    >
      <div className="text-sm sm:text-base font-extrabold tracking-wide">{label}</div>
      <div className="mt-1 text-xs sm:text-sm opacity-80">(Placeholder — سيتم ربطه لاحقاً بـ AdSense)</div>
    </div>
  );
}
