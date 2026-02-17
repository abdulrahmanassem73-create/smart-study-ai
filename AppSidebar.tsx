/*
Design system (Academic AI Study System)
- Visual intent: Midnight Blue + very light gray, crisp borders, subtle depth
- Typography: Changa for headings, Almarai for body (set globally in index.css)
- Direction: RTL, sidebar on the RIGHT
*/

import { Link, useLocation } from "wouter";
import {
  BarChart3,
  BookOpen,
  CloudUpload,
  Home,
  Library,
  BookMarked,
  ShoppingBag,
  Award,
  Settings,
  ClipboardCheck,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

const navItems = [
  { href: "/", label: "الرئيسية / لوحة التحكم", Icon: Home },
  { href: "/رفع-المادة", label: "رفع الماتيريال", Icon: CloudUpload },
  { href: "/مكتبتي", label: "مكتبتي", Icon: BookMarked },
  { href: "/شرح", label: "صفحة الشرح", Icon: BookOpen },
  { href: "/بنك-الأسئلة", label: "بنك الأسئلة", Icon: Library },
  { href: "/امتحان", label: "وضع الامتحان", Icon: ClipboardCheck },
  { href: "/الإحصائيات", label: "الإحصائيات", Icon: BarChart3 },
  { href: "/المتجر", label: "المتجر", Icon: ShoppingBag },
  { href: "/لوحة-الشرف", label: "لوحة الشرف", Icon: Award },
  { href: "/الإعدادات", label: "الإعدادات", Icon: Settings },
] as const;

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar side="right" variant="sidebar" collapsible="icon" className="border-l">
      <SidebarHeader className="px-3 py-4">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "size-9 rounded-xl",
              "bg-primary text-primary-foreground",
              "grid place-items-center",
              "shadow-sm"
            )}
            aria-hidden="true"
          >
            <span className="font-bold">A</span>
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold leading-5">Academic AI</div>
            <div className="text-xs text-muted-foreground">Study System</div>
          </div>
        </div>
      </SidebarHeader>

      <Separator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs">الأقسام</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map(({ href, label, Icon }) => {
                const isActive = location === href;
                return (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={label}>
                      <Link href={href}>
                        <Icon />
                        <span className="truncate">{label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-3 pb-4 space-y-3">
        <div className="text-xs text-muted-foreground leading-5">
          اختصار لوحة المفاتيح:
          <span className="mx-1 rounded-md border px-1.5 py-0.5">Ctrl</span>+
          <span className="mx-1 rounded-md border px-1.5 py-0.5">B</span>
        </div>

        <div className="rounded-xl border bg-secondary/30 px-3 py-2">
          <div className="text-xs font-bold">v1.0</div>
          <div className="text-[11px] text-muted-foreground mt-1 leading-5">
            صُنع بكل حب بواسطة Academic AI
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
