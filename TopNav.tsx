/*
Design system (Academic AI Study System)
- Navbar ثابت أعلى المحتوى
- إبراز اسم المنصة + زر Dark Mode + بروفايل المستخدم
*/

import * as React from "react";
import { motion } from "framer-motion";
import { Bell, Coins, Flame, Moon, Search, Sparkles, Sun } from "lucide-react";

import { useTheme } from "@/contexts/ThemeContext";
import { cloudAuthEnabled, getCurrentUser } from "@/lib/auth";
import { useSyncSnapshot } from "@/lib/sync-state";
import { readLibrary } from "@/lib/library-store";
import { cloudFetchFilesForSearch, cloudSearchInMyFiles } from "@/lib/cloud-store";
import {
  subscribeToNotificationsRealtime,
  subscribeToUserStatsRealtime,
  unsubscribeChannel,
  type NotificationRow,
  type UserStatsRowPayload,
} from "@/lib/realtime";
import { getSupabaseClient } from "@/lib/supabase";
import { getCachedStatsForHeader, levelProgress, levelTitle } from "@/lib/user-stats";
import { getCachedProfile } from "@/lib/profile-store";
import { createAvatarSignedUrl } from "@/lib/cloud-storage";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";

export function TopNav() {
  const { theme, toggleTheme } = useTheme();
  const sync = useSyncSnapshot();

  const user = getCurrentUser();
  const [stats, setStats] = React.useState(() => getCachedStatsForHeader());

  React.useEffect(() => {
    const onStats = (e: Event) => {
      const detail = (e as CustomEvent<import("@/lib/user-stats").UserStats | null>).detail;
      setStats(detail || getCachedStatsForHeader());
    };
    window.addEventListener("aass:stats_updated", onStats);
    return () => window.removeEventListener("aass:stats_updated", onStats);
  }, []);

  // Realtime: user_stats -> تحديث فوري للـ coins/xp/streak
  React.useEffect(() => {
    if (!user || !cloudAuthEnabled()) return;

    const ch = subscribeToUserStatsRealtime({
      user,
      onUpsert: (row: UserStatsRowPayload) => {
        // cache via localStorage (نفس مفتاح user-stats.ts)
        try {
          localStorage.setItem(`aass:user_stats:${user.id}`, JSON.stringify(row));
          window.dispatchEvent(new CustomEvent("aass:stats_updated", { detail: row }));
        } catch {
          // ignore
        }
      },
    });

    return () => {
      unsubscribeChannel(ch);
    };
  }, [user, user?.id]);
  const [, navigate] = useLocation();

  const profile = user ? getCachedProfile(user.id) : null;
  const [avatarUrl, setAvatarUrl] = React.useState<string>("");

  const [notifications, setNotifications] = React.useState<NotificationRow[]>([]);
  const unreadCount = React.useMemo(
    () => notifications.filter((n) => !n.is_read).length,
    [notifications]
  );

  // Smart reminders: files not opened for 3+ days (computed, not persisted)
  const [staleFiles, setStaleFiles] = React.useState<Array<{ id: string; name: string; days: number }>>([]);
  const staleCount = staleFiles.length;

  React.useEffect(() => {
    const u = getCurrentUser();
    const sb = getSupabaseClient();
    if (!u || !cloudAuthEnabled() || !sb) {
      setStaleFiles([]);
      return;
    }

    const now = Date.now();
    const threeDaysAgo = new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString();

    (async () => {
      try {
        const { data, error } = await sb
          .from("files")
          .select("id,name,last_opened_at,created_at")
          .eq("user_id", u.id)
          .or(`last_opened_at.is.null,last_opened_at.lt.${threeDaysAgo}`)
          .order("created_at", { ascending: false })
          .limit(5);
        if (error) throw error;

        const rows = (data as any[]) || [];
        const mapped = rows.map((r) => {
          const last = r?.last_opened_at ? new Date(String(r.last_opened_at)).getTime() : 0;
          const created = r?.created_at ? new Date(String(r.created_at)).getTime() : 0;
          const basis = last || created || now;
          const days = Math.max(0, Math.floor((now - basis) / (24 * 60 * 60 * 1000)));
          return { id: String(r.id), name: String(r.name || "ملف"), days };
        });

        setStaleFiles(mapped.filter((x) => x.days >= 3));
      } catch {
        setStaleFiles([]);
      }
    })();
  }, [user?.id]);

  // Load + subscribe notifications (cloud)
  React.useEffect(() => {
    if (!user || !cloudAuthEnabled()) {
      setNotifications([]);
      return;
    }

    const sb = getSupabaseClient();
    if (!sb) return;

    // initial fetch
    (async () => {
      try {
        const { data, error } = await sb
          .from("notifications")
          .select("id,user_id,title,message,type,is_read,created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(20);
        if (error) throw error;
        setNotifications((data as unknown as NotificationRow[]) || []);
      } catch {
        // ignore
      }
    })();

    const ch = subscribeToNotificationsRealtime({
      user,
      onInsertOrUpdate: (row) => {
        setNotifications((prev) => {
          const merged = [row, ...prev.filter((x) => x.id !== row.id)];
          return merged.slice(0, 30);
        });
      },
    });

    return () => {
      unsubscribeChannel(ch);
    };
  }, [user, user?.id]);

  const [open, setOpen] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [contentHits, setContentHits] = React.useState<
    Array<{ fileId: string; fileName: string; snippet: string; rank: number }>
  >([]);
  const searchTimer = React.useRef<number | null>(null);


  React.useEffect(() => {
    if (!user) return;
    if (!cloudAuthEnabled()) return;

    // 1) لو جوجل موفر avatarUrl مباشرة، استخدمها
    if (user.avatarUrl) {
      setAvatarUrl(user.avatarUrl);
      return;
    }

    // 2) وإلا استخدم avatar_path من الـ profile (Signed URL)
    if (!profile?.avatar_path) {
      setAvatarUrl("");
      return;
    }

    createAvatarSignedUrl({ user, avatarPath: profile.avatar_path, expiresInSec: 60 * 15 })
      .then((url) => setAvatarUrl(url))
      .catch(() => setAvatarUrl(""));
  }, [user, user?.id, profile?.avatar_path, user?.avatarUrl]);
  const [files, setFiles] = React.useState<
    Array<{ id: string; fileName: string; uploadedAt: string }>
  >([]);

  React.useEffect(() => {
    let alive = true;

    if (!user) {
      setFiles([]);
      return;
    }

    const cloud = cloudAuthEnabled();

    if (cloud) {
      cloudFetchFilesForSearch(user)
        .then((rows) => {
          if (!alive) return;
          setFiles(rows);
        })
        .catch(() => {
          // fallback local
          if (!alive) return;
          setFiles(
            readLibrary(user.id).map((x) => ({
              id: x.id,
              fileName: x.fileName,
              uploadedAt: x.uploadedAt,
            }))
          );
        });
      return () => {
        alive = false;
      };
    }

    setFiles(
      readLibrary(user.id).map((x) => ({
        id: x.id,
        fileName: x.fileName,
        uploadedAt: x.uploadedAt,
      }))
    );

    return () => {
      alive = false;
    };
  }, [user, user?.id]);

  const titleHits = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return files.slice(0, 8);
    return files.filter((f) => f.fileName.toLowerCase().includes(s)).slice(0, 8);
  }, [q, files]);

  // Cloud deep search (content snippets)
  React.useEffect(() => {
    if (searchTimer.current) window.clearTimeout(searchTimer.current);

    const s = q.trim();
    if (!user || !cloudAuthEnabled() || s.length < 2) {
      setContentHits([]);
      return;
    }

    searchTimer.current = window.setTimeout(() => {
      cloudSearchInMyFiles({ user, q: s, limit: 8 })
        .then((rows) => setContentHits(rows))
        .catch(() => setContentHits([]));
    }, 220);

    return () => {
      if (searchTimer.current) window.clearTimeout(searchTimer.current);
    };
  }, [q, user, user?.id]);

  return (
    <header
      className={cn(
        "sticky top-0 z-20",
        "bg-background/85 backdrop-blur",
        "border-b"
      )}
    >
      <div className="h-16 px-4 md:px-6 flex items-center gap-4">
        <div className="md:hidden flex items-center gap-2">
          <SidebarTrigger aria-label="فتح القائمة" title="القائمة" />

          {/* Mobile Search Icon */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label="بحث"
                title="بحث"
              >
                <Search className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="top"
              className="p-0 h-svh bg-background/70 backdrop-blur-md"
            >
              <SheetHeader className="px-4 py-4 border-b dark:bg-white/10 dark:backdrop-blur-md dark:border-white/10">
                <SheetTitle className="text-xl">بحث في مكتبتي</SheetTitle>
                <div className="text-xs text-muted-foreground">
                  اكتب اسم الملف وسيظهر لك فوراً
                </div>
              </SheetHeader>

              <div className="p-4">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                  className="space-y-3"
                >
                  <div className="relative">
                    <Search className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      autoFocus
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="ابحث عن ملف..."
                      className="pr-10 h-12 text-base"
                    />
                  </div>

                  <div className="rounded-xl border dark:bg-white/10 dark:border-white/10 overflow-hidden">
                    <Command>
                      <CommandList className="max-h-[calc(100svh-220px)] overflow-y-auto">
                        <CommandEmpty>لا توجد نتائج</CommandEmpty>
                        <CommandGroup heading="النتائج">
                          {titleHits.map((f) => (
                            <CommandItem
                              key={f.id}
                              value={f.fileName}
                              className="py-3 text-base"
                              onSelect={() => {
                                sessionStorage.setItem("aass:active_file_id", f.id);
                                sessionStorage.setItem("aass:last_uploaded_file_name", f.fileName);
                                sessionStorage.removeItem("aass:deep_link_snippet");
                                window.location.hash = `#/explain/${f.id}`;
                                setMobileOpen(false);
                              }}
                            >
                              {f.fileName}
                            </CommandItem>
                          ))}
                        </CommandGroup>

                        {contentHits.length > 0 && (
                          <CommandGroup heading="من داخل المحتوى">
                            {contentHits.map((h) => (
                              <CommandItem
                                key={`c_${h.fileId}_${h.rank}`}
                                value={h.fileName}
                                className="py-3 text-base"
                                onSelect={() => {
                                  sessionStorage.setItem("aass:active_file_id", h.fileId);
                                  sessionStorage.setItem("aass:last_uploaded_file_name", h.fileName);
                                  sessionStorage.setItem("aass:deep_link_snippet", h.snippet);
                                  window.location.hash = `#/explain/${h.fileId}`;
                                  setMobileOpen(false);
                                }}
                              >
                                <div className="w-full">
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="font-semibold truncate">{h.fileName}</div>
                                    <Sparkles className="size-4 text-primary" />
                                  </div>
                                  <div className="mt-1 text-xs text-muted-foreground leading-5 line-clamp-2">
                                    {h.snippet.replace(/<<|>>/g, "")}
                                  </div>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        )}
                      </CommandList>
                    </Command>
                  </div>
                </motion.div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={cn(
              "size-9 rounded-xl",
              "bg-primary text-primary-foreground",
              "grid place-items-center"
            )}
            aria-hidden="true"
          >
            <span className="font-extrabold">AI</span>
          </div>
          <div className="min-w-0">
            <div className="text-base font-bold leading-5">Academic AI Study System</div>
            <div className="text-xs text-muted-foreground">منصة مذاكرة ذكية</div>
          </div>
        </div>

        <div className="flex-1" />

        {/* Global Search */}
        <div className="hidden md:block w-[320px]">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <div className="relative">
                <Search className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    if (!open) setOpen(true);
                  }}
                  onFocus={() => setOpen(true)}
                  placeholder="ابحث في ملفات مكتبتك..."
                  className="pr-10"
                />
              </div>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[320px]" align="start">
              <Command>
                <CommandInput
                  value={q}
                  onValueChange={setQ}
                  placeholder="ابحث عن ملف..."
                />
                <CommandList>
                  <CommandEmpty>لا توجد نتائج</CommandEmpty>
                  <CommandGroup heading="الملفات">
                    {titleHits.map((f) => (
                      <CommandItem
                        key={f.id}
                        value={f.fileName}
                        onSelect={() => {
                          sessionStorage.setItem("aass:active_file_id", f.id);
                          sessionStorage.setItem("aass:last_uploaded_file_name", f.fileName);
                          sessionStorage.removeItem("aass:deep_link_snippet");
                          window.location.hash = "#/شرح";
                          setOpen(false);
                          setMobileOpen(false);
                        }}
                      >
                        {f.fileName}
                      </CommandItem>
                    ))}
                  </CommandGroup>

                  {contentHits.length > 0 && (
                    <CommandGroup heading="من داخل المحتوى">
                      {contentHits.map((h) => (
                        <CommandItem
                          key={`c_${h.fileId}_${h.rank}`}
                          value={h.fileName}
                          onSelect={() => {
                            sessionStorage.setItem("aass:active_file_id", h.fileId);
                            sessionStorage.setItem("aass:last_uploaded_file_name", h.fileName);
                            sessionStorage.setItem("aass:deep_link_snippet", h.snippet);
                            window.location.hash = "#/شرح";
                            setOpen(false);
                            setMobileOpen(false);
                          }}
                        >
                          <div className="w-full">
                            <div className="flex items-center justify-between gap-3">
                              <div className="font-semibold truncate">{h.fileName}</div>
                              <Sparkles className="size-4 text-primary" />
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground leading-5 line-clamp-2">
                              {h.snippet.replace(/<<|>>/g, "")}
                            </div>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex items-center gap-2">
          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="relative" aria-label="التنبيهات" title="التنبيهات">
                <Bell className="size-4" />
                {(unreadCount > 0 || staleCount > 0) && (
                  <span className="absolute -top-1 -left-1 size-2.5 rounded-full bg-rose-500" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[320px]">
              <DropdownMenuLabel>التنبيهات</DropdownMenuLabel>
              <DropdownMenuSeparator />

              {staleFiles.length > 0 && (
                <div className="px-3 py-2">
                  <div className="text-xs font-bold text-muted-foreground">تذكير بالمراجعة</div>
                  <div className="mt-2 grid gap-2">
                    {staleFiles.slice(0, 4).map((f) => (
                      <button
                        key={`stale_${f.id}`}
                        className="w-full text-right rounded-lg border px-3 py-2 hover:bg-secondary/40 transition"
                        onClick={(e) => {
                          e.preventDefault();
                          sessionStorage.setItem("aass:active_file_id", f.id);
                          sessionStorage.setItem("aass:last_uploaded_file_name", f.name);
                          window.location.hash = `#/explain/${f.id}`;
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-semibold text-sm truncate">{f.name}</div>
                          <span className="text-[11px] text-muted-foreground">منذ {f.days} أيام</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">لم تفتح هذا الملف منذ فترة — راجع أهم النقاط.</div>
                      </button>
                    ))}
                  </div>
                  <DropdownMenuSeparator className="my-2" />
                </div>
              )}

              {notifications.length === 0 && staleFiles.length === 0 && (
                <div className="px-3 py-3 text-sm text-muted-foreground">لا توجد تنبيهات</div>
              )}

              {notifications.slice(0, 8).map((n) => (
                <DropdownMenuItem
                  key={n.id}
                  className="flex flex-col items-start gap-1 py-3"
                  onSelect={async (e) => {
                    e.preventDefault();
                    if (!cloudAuthEnabled() || !user) return;
                    try {
                      const sb = getSupabaseClient();
                      if (!sb) return;
                      await sb
                        .from("notifications")
                        .update({ is_read: true })
                        .eq("id", n.id)
                        .eq("user_id", user.id);
                      setNotifications((prev) =>
                        prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x))
                      );
                    } catch {
                      // ignore
                    }
                  }}
                >
                  <div className="w-full flex items-center justify-between gap-2">
                    <div className="font-semibold text-sm truncate">{n.title}</div>
                    {!n.is_read && <span className="size-2 rounded-full bg-rose-500" />}
                  </div>
                  <div className="text-xs text-muted-foreground leading-5 line-clamp-2">{n.message}</div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {/* Sync Indicator */}
          <div
            className={cn(
              "hidden sm:flex items-center gap-2 px-3 h-9 rounded-full text-xs font-semibold border",
              (sync.status === "synced" || sync.status === "live") &&
                "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-200",
              sync.status === "syncing" && "bg-sky-500/10 border-sky-500/20 text-sky-700 dark:text-sky-200",
              sync.status === "error" && "bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-200",
              sync.status === "offline" &&
                "bg-amber-500/10 border-amber-500/20 text-amber-800 dark:text-amber-200",
              sync.status === "idle" && "bg-muted/40 border-border text-muted-foreground"
            )}
            title={sync.label || sync.status}
          >
            <span
              className={cn(
                "size-2 rounded-full",
                (sync.status === "synced" || sync.status === "live") &&
                  "bg-emerald-500" + (sync.status === "live" ? " animate-pulse" : ""),
                sync.status === "syncing" && "bg-sky-500 animate-pulse",
                sync.status === "error" && "bg-rose-500",
                sync.status === "offline" && "bg-amber-500",
                sync.status === "idle" && "bg-muted-foreground/60"
              )}
            />
            <span>{sync.label || "Sync"}</span>
          </div>

          {/* XP Progress */}
          {stats && (
            <div className="hidden lg:flex items-center gap-3 px-3 h-9 rounded-full border bg-muted/25">
              <div className="text-xs font-bold">XP</div>
              <div className="w-40">
                <Progress value={levelProgress(stats.total_xp).pct} />
              </div>
              <div className="text-[11px] text-muted-foreground tabular-nums">
                {levelProgress(stats.total_xp).into}/{levelProgress(stats.total_xp).needed}
              </div>
              <div className="h-6 w-px bg-border mx-1" />
              <div className="inline-flex items-center gap-1 text-[12px] font-extrabold" title="Coins">
                <Coins className="size-4 text-yellow-500" />
                <span className="tabular-nums">{Math.max(0, stats.coins || 0)}</span>
              </div>
            </div>
          )}
          <Button
            variant="outline"
            size="icon"
            onClick={toggleTheme}
            aria-label="تبديل الوضع الليلي"
            title="تبديل الوضع الليلي"
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>

          <Separator orientation="vertical" className="mx-1 h-7" />

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-sm font-semibold leading-5">{profile?.display_name || user?.name || "مستخدم"}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <span>{profile?.study_title || "طالب"}</span>
                {stats && (
                  <>
                    <span
                      className="rounded-full border px-2 py-0.5 text-[11px] dark:bg-white/10 dark:border-white/10"
                      title="مستوى الطالب"
                    >
                      Level {stats.current_level} — {levelTitle(stats.current_level)}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] dark:bg-white/10 dark:border-white/10" title="Streak">
                      <Flame className="size-3 text-orange-500" />
                      {Math.max(0, stats.streak_count)}
                    </span>
                  </>
                )}
              </div>
            </div>
            <Avatar className="size-9 cursor-pointer" onClick={() => navigate("/profile")}>
              {avatarUrl ? <AvatarImage src={avatarUrl} alt="avatar" /> : null}
              <AvatarFallback className="bg-secondary text-secondary-foreground">
                {(profile?.display_name || user?.name || "م").slice(0, 1)}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
      </div>
    </header>
  );
}
