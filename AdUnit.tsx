/*
AdUnit (Google AdSense)
- يتوقع وجود سكريبت AdSense في index.html (head)
- يستخدم adsbygoogle.push({}) داخل useEffect لضمان التوافق مع React
- يمكن إخفاؤه عبر user_settings.ads_enabled

ملاحظة مهمة:
- AdSense يحتاج ad-client (ca-pub-...) و ad-slot حقيقي.
- في بيئة التطوير قد لا تظهر الإعلانات.
*/

import * as React from "react";
import { cn } from "@/lib/utils";
import { getCurrentUser } from "@/lib/auth";
import { getCachedSettings } from "@/lib/user-settings";

export default function AdUnit(props: {
  /** يظهر فوق الإعلان للامتثال */
  adLabel?: string;
  className?: string;
  /** مثال: ca-pub-123... (يفضل تمريره من env) */
  client?: string;
  /** ad-slot id من AdSense */
  slot: string;
  /** Responsive by default */
  format?: string;
  fullWidthResponsive?: boolean;
}) {
  const client =
    props.client ||
    (import.meta.env.VITE_ADSENSE_CLIENT as string | undefined) ||
    "";

  const [enabled, setEnabled] = React.useState(() => {
    const u = getCurrentUser();
    if (!u) return true;
    const s = getCachedSettings(u.id) as any;
    if (typeof s?.ads_enabled === "boolean") return Boolean(s.ads_enabled);
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

  const insRef = React.useRef<HTMLModElement | null>(null);

  React.useEffect(() => {
    if (!enabled) return;
    if (!client || !props.slot) return;

    // In some cases AdSense may try to fill the same slot twice if React re-renders.
    // We do best-effort push; if it errors, we silently ignore.
    try {
      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.push({});
    } catch {
      // ignore
    }
  }, [enabled, client, props.slot]);

  if (!enabled) return null;

  const adLabel = props.adLabel || "إعلان";

  // If client/slot are not configured, keep a visible placeholder to avoid blank layout.
  if (!client || !props.slot) {
    return (
      <div className={cn("w-full", props.className)} aria-label="وحدة إعلانية">
        <div className="mb-1 text-[10px] font-bold tracking-wider text-muted-foreground">{adLabel}</div>
        <div
          className={cn(
            "w-full rounded-xl border border-dashed bg-muted/40 text-muted-foreground",
            "grid place-items-center min-h-[90px] sm:min-h-[110px] px-4 py-4"
          )}
        >
          <div className="text-sm sm:text-base font-extrabold">مساحة إعلانية</div>
          <div className="mt-1 text-xs sm:text-sm opacity-80">اضبط VITE_ADSENSE_CLIENT و ad-slot</div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("w-full", props.className)} aria-label="وحدة إعلانية">
      <div className="mb-1 text-[10px] font-bold tracking-wider text-muted-foreground">{adLabel}</div>
      <ins
        ref={insRef as any}
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={client}
        data-ad-slot={props.slot}
        data-ad-format={props.format || "auto"}
        data-full-width-responsive={props.fullWidthResponsive === false ? "false" : "true"}
      />
    </div>
  );
}
