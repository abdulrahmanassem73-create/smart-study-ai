import * as React from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { LogIn, UserPlus } from "lucide-react";

import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  cloudAuthEnabled,
  getCurrentUser,
  signIn,
  signInWithGoogle,
  signUp,
} from "@/lib/auth";
import { cn } from "@/lib/utils";

const glassCard =
  "dark:bg-white/10 dark:backdrop-blur-md dark:border-white/10";

export default function AuthPage() {
  const [, navigate] = useLocation();

  const existing = React.useMemo(() => getCurrentUser(), []);
  const [mode, setMode] = React.useState<"signin" | "signup">("signin");

  const [name, setName] = React.useState(existing?.name || "");
  const [email, setEmail] = React.useState(existing?.email || "");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const cloud = cloudAuthEnabled();

  React.useEffect(() => {
    // لو رجعنا من OAuth redirect وفيه مستخدم بالفعل
    const u = getCurrentUser();
    if (u) navigate("/");
  }, [navigate]);

  const submit = async () => { 
    setLoading(true);
    try {
      if (mode === "signup") {
        await signUp({ name, email, password: cloud ? password : "local" });
        toast.success("تم إنشاء الحساب وتسجيل الدخول");
      } else {
        await signIn({ email, password: cloud ? password : "local" });
        toast.success("تم تسجيل الدخول");
      }
      navigate("/");
    } catch (e: any) { 
      console.error(e);
      const code = e?.message;
      if (code === "EMAIL_EXISTS") {
        toast.error("هذا البريد مسجل بالفعل. جرّب تسجيل الدخول.");
      } else if (code === "NOT_FOUND") {
        toast.error("لا يوجد حساب بهذا البريد. أنشئ حساباً جديداً.");
      } else {
        toast.error("تحقق من البيانات وأعد المحاولة");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell>
      <section className="mx-auto w-full max-w-2xl space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl md:text-4xl font-extrabold">الحساب</h1>
          <p className="text-muted-foreground leading-7">
            تسجيل الدخول/إنشاء حساب لحفظ مكتبتك ونتائج التحليل بشكل دائم على السحابة.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          <Card className={cn(glassCard)}>
            <CardHeader className="pb-3">
              <CardTitle className="text-2xl">
                {mode === "signup" ? "إنشاء حساب" : "تسجيل الدخول"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Google OAuth (Primary) */}
              <div className="grid place-items-center">
                <Button
                  variant={cloud ? "default" : "secondary"}
                  className="w-full max-w-sm gap-2"
                  disabled={loading || !cloud}
                  onClick={async () => {
                    if (!cloud) {
                      toast.error("السحابة غير مفعلة حالياً. تأكد من مفاتيح Supabase ثم أعد البناء.");
                      return;
                    }
                    toast.message("جاري الاتصال بجوجل...");
                    try {
                      setLoading(true);
                      await signInWithGoogle();
                    } catch {
                      toast.error("تعذر بدء تسجيل الدخول بجوجل");
                      setLoading(false);
                    }
                  }}
                >
                  {/* Google "G" official colors (SVG) */}
                  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.677 32.654 29.223 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.962 3.038l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
                    <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 16.108 19.027 12 24 12c3.059 0 5.842 1.154 7.962 3.038l5.657-5.657C34.046 6.053 29.268 4 24 4c-7.682 0-14.356 4.333-17.694 10.691z"/>
                    <path fill="#4CAF50" d="M24 44c5.122 0 9.86-1.964 13.409-5.159l-6.19-5.238C29.218 35.091 26.715 36 24 36c-5.202 0-9.646-3.325-11.271-7.946l-6.52 5.025C9.505 39.556 16.227 44 24 44z"/>
                    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.05 12.05 0 0 1-4.084 5.603l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
                  </svg>
                  Sign in with Google
                </Button>
              </div>

              <div className="relative">
                <Separator />
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-xs text-muted-foreground">
                  أو
                </div>
              </div>
              {mode === "signup" && (
                <div className="grid gap-2">
                  <Label htmlFor="name">الاسم</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="مثال: عبدالرحمن"
                  />
                </div>
              )}

              <div className="grid gap-2">
                <Label htmlFor="email">البريد الإلكتروني</Label>
                <Input
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                />
              </div>

              {cloud && (
                <div className="grid gap-2">
                  <Label htmlFor="password">كلمة المرور</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <Button className="gap-2" onClick={submit} disabled={loading}>
                  {mode === "signup" ? (
                    <>
                      <UserPlus className="size-4" />
                      إنشاء الحساب
                    </>
                  ) : (
                    <>
                      <LogIn className="size-4" />
                      تسجيل الدخول
                    </>
                  )}
                </Button>

                

                <Button
                  variant="outline"
                  onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
                >
                  {mode === "signup"
                    ? "لدي حساب بالفعل"
                    : "إنشاء حساب جديد"}
                </Button>
              </div>

              <Separator />

              <div className="text-xs text-muted-foreground leading-6">
                {cloud
                  ? "مفعل: Supabase Auth — تسجيل حقيقي + مزامنة سحابية."
                  : "لتفعيل السحابة: ضع VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY ثم أعد البناء."}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </section>
    </AppShell>
  );
}
