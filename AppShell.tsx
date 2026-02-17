/*
App Shell
- RTL
- Sidebar ثابت يمين + محتوى + Navbar
*/

import * as React from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { TopNav } from "@/components/layout/TopNav";
import { getCurrentUser } from "@/lib/auth";
import { runInitialCloudSync } from "@/lib/cloud-sync";
import { setSyncSnapshot } from "@/lib/sync-state";
import { getOrCreateStats } from "@/lib/user-stats";
import { getOrCreateProfile } from "@/lib/profile-store";
import { checkSupabaseConnection, isSupabaseConfigured } from "@/lib/supabase";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  React.useEffect(() => {
    const configured = isSupabaseConfigured();
    const u = getCurrentUser();

    if (!configured) {
      setSyncSnapshot({ status: "offline", label: "وضع الأوفلاين ⚠️", live: false });
      return;
    }

    // لا نعرض "متصل بالسحابة" إلا عند وجود Session/User
    if (!u) {
      setSyncSnapshot({ status: "idle", label: "السحابة جاهزة", live: false });
      return;
    }

    // Session موجودة
    setSyncSnapshot({ status: "synced", label: "متصل بالسحابة ☁️", live: false });

    // تحقق اتصال (ولو فشل نعتبره Offline)
    checkSupabaseConnection().then((r) => {
      if (!r.ok) {
        setSyncSnapshot({ status: "offline", label: "وضع الأوفلاين ⚠️", live: false });
        return;
      }
      // اتصال OK: ثبّت الرسالة
      setSyncSnapshot({ status: "synced", label: "متصل بالسحابة ☁️", live: false });
    });

    runInitialCloudSync(u);

    // ensure user_stats exists (for header level)
    getOrCreateStats(u).catch(() => {});

    // ensure profile exists (for display name/avatar)
    getOrCreateProfile(u).catch(() => {});
  }, [location]);

  return (
    <SidebarProvider defaultOpen>
      <AppSidebar />
      <SidebarInset>
        <TopNav />
        <main className="min-h-[calc(100svh-4rem)] px-4 py-6 md:px-6">
          <motion.div
            key={location}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            {children}
          </motion.div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
