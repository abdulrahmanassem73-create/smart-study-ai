/*
Supabase Storage helpers
- Buckets:
  - pdfs: private, path: <userId>/<fileId>.pdf
  - avatars: private, path: <userId>/avatar.<ext>
- نستخدم Signed URLs لتجنب Public exposure.
*/

import { getSupabaseClient } from "@/lib/supabase";
import type { AuthUser } from "@/lib/auth";

export async function uploadMaterialToCloud(params: {
  user: AuthUser;
  fileId: string;
  file: File;
}) {
  const sb = getSupabaseClient();
  if (!sb) throw new Error("CLOUD_NOT_CONFIGURED");

  const ext = (params.file.name.split(".").pop() || "bin").toLowerCase();
  const safeExt = /^(pdf|doc|docx)$/.test(ext) ? ext : "bin";
  const path = `${params.user.id}/${params.fileId}.${safeExt}`;

  const { error } = await sb.storage.from("pdfs").upload(path, params.file, {
    upsert: true,
    contentType: params.file.type || "application/octet-stream",
    cacheControl: "3600",
  });

  if (error) throw new Error(error.message);
  return { path };
}

export async function uploadPdfToCloud(params: {
  user: AuthUser;
  fileId: string;
  file: File;
}) {
  const sb = getSupabaseClient();
  if (!sb) throw new Error("CLOUD_NOT_CONFIGURED");

  const path = `${params.user.id}/${params.fileId}.pdf`;

  const { error } = await sb.storage
    .from("pdfs")
    .upload(path, params.file, {
      upsert: true,
      contentType: params.file.type || "application/pdf",
      cacheControl: "3600",
    });

  if (error) throw new Error(error.message);
  return { path };
}

export async function createPdfSignedUrl(params: {
  user: AuthUser;
  pdfPath: string;
  expiresInSec?: number;
}) {
  const sb = getSupabaseClient();
  if (!sb) throw new Error("CLOUD_NOT_CONFIGURED");

  // extra safety: enforce folder-per-user on client too
  if (!params.pdfPath.startsWith(`${params.user.id}/`)) {
    throw new Error("FORBIDDEN_PATH");
  }

  const { data, error } = await sb.storage
    .from("pdfs")
    .createSignedUrl(params.pdfPath, params.expiresInSec ?? 60 * 10);

  if (error) throw new Error(error.message);
  return data.signedUrl;
}

export async function uploadAvatarToCloud(params: {
  user: AuthUser;
  file: File;
}) {
  const sb = getSupabaseClient();
  if (!sb) throw new Error("CLOUD_NOT_CONFIGURED");

  const ext = (params.file.name.split(".").pop() || "png").toLowerCase();
  const safeExt = /^(png|jpg|jpeg|webp)$/.test(ext) ? ext : "png";
  const path = `${params.user.id}/avatar.${safeExt}`;

  const { error } = await sb.storage
    .from("avatars")
    .upload(path, params.file, {
      upsert: true,
      contentType: params.file.type || `image/${safeExt}`,
      cacheControl: "3600",
    });

  if (error) throw new Error(error.message);
  return { path };
}

export async function createAvatarSignedUrl(params: {
  user: AuthUser;
  avatarPath: string;
  expiresInSec?: number;
}) {
  const sb = getSupabaseClient();
  if (!sb) throw new Error("CLOUD_NOT_CONFIGURED");

  if (!params.avatarPath.startsWith(`${params.user.id}/`)) {
    throw new Error("FORBIDDEN_PATH");
  }

  const { data, error } = await sb.storage
    .from("avatars")
    .createSignedUrl(params.avatarPath, params.expiresInSec ?? 60 * 10);

  if (error) throw new Error(error.message);
  return data.signedUrl;
}
