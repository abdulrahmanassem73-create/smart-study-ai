import * as React from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { Camera, Mail, Save, User as UserIcon } from "lucide-react";

import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";

import { cloudAuthEnabled, getCurrentUser } from "@/lib/auth";
import { getOrCreateProfile, updateProfile } from "@/lib/profile-store";
import { createAvatarSignedUrl, uploadAvatarToCloud } from "@/lib/cloud-storage";
import { cloudFetchFilesForSearch } from "@/lib/cloud-store";

const glassCard = "dark:bg-white/10 dark:backdrop-blur-md dark:border-white/10";

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("ar-EG", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatBytes(bytes: number) {
  if (!bytes || bytes <= 0) return "0 B";
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(2)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}

export default function ProfilePage() {
  const [, navigate] = useLocation();

  const user = getCurrentUser();
  const cloud = cloudAuthEnabled();

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  const [displayName, setDisplayName] = React.useState("");
  const [studyTitle, setStudyTitle] = React.useState("");
  const [avatarPath, setAvatarPath] = React.useState("");
  const [avatarUrl, setAvatarUrl] = React.useState("");

  const [storageBytes, setStorageBytes] = React.useState(0);

  // (Placeholder) storage usage card can be re-enabled لاحقاً

  React.useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        setLoading(true);
        const p = await getOrCreateProfile(user);
        setDisplayName(p.display_name || user.name || "مستخدم");
        setStudyTitle(p.study_title || "");
        setAvatarPath(p.avatar_path || "");

        if (cloud && p.avatar_path) {
          const url = await createAvatarSignedUrl({ user, avatarPath: p.avatar_path });
          setAvatarUrl(url);
        }

        // storage usage: (تقريبي) — حالياً cloudFetchFilesForSearch لا يعيد الحجم
        if (cloud) {
          const rows = await cloudFetchFilesForSearch(user, 1000);
          void rows;
          setStorageBytes(0);
        }
      } catch (e: any) {
        console.error(e);
        toast.error("تعذر تحميل البروفايل");
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.id]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await updateProfile(user, {
        display_name: displayName.trim() || user.name || "مستخدم",
        study_title: studyTitle.trim(),
        avatar_path: avatarPath,
      } as any);

      toast.success("تم حفظ بياناتك");
    } catch (e: any) {
      console.error(e);
      toast.error("تعذر حفظ البيانات");
    } finally {
      setSaving(false);
    }
  };

  const onPickAvatar: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    if (!user) return;
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;

    if (!cloud) {
      toast.error("فعّل Supabase أولاً لرفع الصورة الشخصية");
      return;
    }

    try {
      setSaving(true);
      const { path } = await uploadAvatarToCloud({ user, file: f });
      setAvatarPath(path);
      await updateProfile(user, { avatar_path: path } as any);
      const url = await createAvatarSignedUrl({ user, avatarPath: path });
      setAvatarUrl(url);
      toast.success("تم تحديث الصورة الشخصية");
    } catch (e: any) {
      console.error(e);
      toast.error("فشل رفع الصورة");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <section className="mx-auto w-full max-w-4xl space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl md:text-4xl font-extrabold">الملف الشخصي</h1>
          <p className="text-muted-foreground leading-7">
            عدّل اسمك الدراسي وصورتك — وتابع استهلاكك للتخزين السحابي.
          </p>
        </div>

        {!user && (
          <Card className={glassCard}>
            <CardContent className="pt-6 space-y-3">
              <div className="font-extrabold">سجّل دخولك أولاً</div>
              <div className="text-sm text-muted-foreground leading-7">
                الملف الشخصي مرتبط بالحساب.
              </div>
              <Button onClick={() => navigate("/auth")}>الذهاب لصفحة الحساب</Button>
            </CardContent>
          </Card>
        )}

        {user && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className={glassCard}>
              <CardHeader className="pb-3">
                <CardTitle className="text-2xl flex items-center gap-2">
                  <UserIcon className="size-5" />
                  بياناتي
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <Avatar className="size-20">
                    {avatarUrl ? <AvatarImage src={avatarUrl} /> : null}
                    <AvatarFallback className="text-xl font-extrabold">
                      {(displayName || user.name || "م").slice(0, 1)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <Mail className="size-4" /> {user.email}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      تاريخ الانضمام: {formatDate(user.createdAt)}
                    </div>

                    <div className="flex items-center gap-2">
                      <Label
                        htmlFor="avatar"
                        className="inline-flex items-center gap-2 text-sm font-semibold"
                      >
                        <Camera className="size-4" />
                        صورة شخصية
                      </Label>
                      <Input
                        id="avatar"
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="max-w-[260px]"
                        onChange={onPickAvatar}
                        disabled={!cloud || saving}
                      />
                    </div>

                    {!cloud && (
                      <div className="text-xs text-muted-foreground">
                        لتفعيل الصورة الشخصية: اضبط مفاتيح Supabase في البيئة.
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="displayName">الاسم المعروض</Label>
                    <Input
                      id="displayName"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="مثال: عبدالرحمن"
                      disabled={loading || saving}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="studyTitle">اللقب الدراسي</Label>
                    <Input
                      id="studyTitle"
                      value={studyTitle}
                      onChange={(e) => setStudyTitle(e.target.value)}
                      placeholder="مثال: طالب حاسبات - سنة أولى"
                      disabled={loading || saving}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button className="gap-2" onClick={save} disabled={saving || loading}>
                    <Save className="size-4" />
                    حفظ
                  </Button>
                </div>

                <Separator />

                <div className="rounded-xl border p-4 dark:bg-white/10 dark:border-white/10">
                  <div className="font-extrabold">استهلاك التخزين</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {cloud ? (
                      <>
                        إجمالي ملفاتك (تقريبي): <b>{formatBytes(storageBytes)}</b>
                      </>
                    ) : (
                      "التخزين السحابي غير مفعل حالياً"
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </section>
    </AppShell>
  );
}
