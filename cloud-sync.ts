/*
Initial sync (LocalStorage -> Supabase)
- يرفع ملفات/محادثات موجودة محلياً وغير موجودة في السحابة.
- الهدف: أول تسجيل دخول يؤمّن البيانات ضد مسح الكاش.
*/

import { toast } from "sonner";
import type { AuthUser } from "@/lib/auth";
import { cloudListFileIds, cloudUpsertChat, cloudUpsertFile } from "@/lib/cloud-store";
import { readLibrary, readExtractSummary } from "@/lib/library-store";
import { setSyncSnapshot } from "@/lib/sync-state";

const DONE_KEY = (userId: string) => `aass:cloud_initial_sync_done:${userId}`;

function safeJsonParse(raw: string | null) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function listLocalChatKeys(userId: string) {
  const prefix = `aass:chat:${userId}:`;
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i) || "";
    if (k.startsWith(prefix)) keys.push(k);
  }
  return keys;
}

export async function runInitialCloudSync(user: AuthUser) {
  if (!user?.id) return;

  const done = localStorage.getItem(DONE_KEY(user.id));
  if (done === "1") {
    setSyncSnapshot({ status: "synced", label: "Cloud" });
    return;
  }

  setSyncSnapshot({ status: "syncing", label: "جاري المزامنة..." });

  try {
    const localFiles = readLibrary(user.id);
    const ids = localFiles.map((x) => x.id);

    // موجود على السحابة؟
    const remoteIds = ids.length ? await cloudListFileIds(user, ids) : [];
    const remoteSet = new Set(remoteIds);

    let uploadedCount = 0;

    for (const f of localFiles) {
      if (remoteSet.has(f.id)) continue;

      const summary = readExtractSummary(user, f.id) || "";
      // content: لو مش موجود النص الكامل (كان في sessionStorage غالباً) نرفع summary كبديل
      const content = summary;

      await cloudUpsertFile(user, {
        id: f.id,
        name: f.fileName,
        content,
        summary,
      });

      uploadedCount++;
    }

    // migrate chats
    const chatKeys = listLocalChatKeys(user.id);
    for (const k of chatKeys) {
      const raw = localStorage.getItem(k);
      const msgs = safeJsonParse(raw);
      if (!Array.isArray(msgs)) continue;
      const fileId = k.split(":").slice(-1)[0];
      if (!fileId) continue;

      // نضمن وجود ملف على السحابة (حتى لو summary فاضي)
      if (!remoteSet.has(fileId)) {
        await cloudUpsertFile(user, {
          id: fileId,
          name: sessionStorage.getItem("aass:last_uploaded_file_name") || "(ملف)",
          content: "",
          summary: "",
        });
        remoteSet.add(fileId);
      }

      await cloudUpsertChat({ user, fileId, messages: msgs });
    }

    localStorage.setItem(DONE_KEY(user.id), "1");
    setSyncSnapshot({ status: "synced", label: "Cloud" });

    if (uploadedCount > 0) {
      toast.success(`تمت المزامنة الأولية بنجاح (${uploadedCount} ملف)`);
    } else {
      toast.success("تم التأكد: بياناتك السحابية محدثة");
    }
  } catch (e: any) {
    console.error(e);
    setSyncSnapshot({ status: "error", label: "خطأ مزامنة" });
    toast.error("تعذر إكمال المزامنة السحابية");
  }
}
