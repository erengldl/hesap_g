import { randomUUID } from "node:crypto";
import { put, del } from "@vercel/blob";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
const MIME_TO_EXTENSION = new Map<string, string>([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["image/gif", ".gif"],
]);

function resolveExtension(file: File) {
  const mimeExtension = MIME_TO_EXTENSION.get(file.type);
  if (mimeExtension) return mimeExtension;

  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension) {
    const dotExt = "." + extension;
    if (ALLOWED_EXTENSIONS.has(dotExt)) {
      return dotExt === ".jpeg" ? ".jpg" : dotExt;
    }
  }

  return null;
}

function resolveBlobPath(imageUrl: string) {
  const trimmed = imageUrl.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return new URL(trimmed).pathname.replace(/^\/+/, "");
  } catch {
    return trimmed.replace(/^\/+/, "");
  }
}

export async function saveProductImageUpload(file: File, authUserId: string) {
  const normalizedAuthUserId = authUserId.trim();
  if (!normalizedAuthUserId) {
    throw new Error("Authenticated user id is required.");
  }

  if (file.size <= 0) {
    throw new Error("Boş dosya yüklenemez.");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error("Gorsel boyutu 5 MB sinirini asmamali.");
  }

  const extension = resolveExtension(file);
  if (!extension) {
    throw new Error("Sadece JPG, PNG, WebP veya GIF yüklenebilir.");
  }

  const fileName = `products/${normalizedAuthUserId}/${Date.now()}-${randomUUID()}${extension}`;
  const blob = await put(fileName, file, { access: "public" });

  return {
    url: blob.url,
    fileName: blob.pathname,
  };
}

export async function deleteProductImageUpload(
  imageUrl: string,
  options: {
    authUserId?: string | null;
    allowLegacyDeletion?: boolean;
  } = {}
) {
  const trimmedUrl = imageUrl.trim();
  if (!trimmedUrl) {
    return false;
  }

  const blobPath = resolveBlobPath(trimmedUrl);
  if (!blobPath) {
    return false;
  }

  const normalizedAuthUserId = options.authUserId?.trim() || "";
  const ownedPrefix = normalizedAuthUserId ? `products/${normalizedAuthUserId}/` : null;
  const legacyPrefix = "products/";

  if (!ownedPrefix || !blobPath.startsWith(ownedPrefix)) {
    if (!options.allowLegacyDeletion || !blobPath.startsWith(legacyPrefix)) {
      throw new Error("Görsel sahipliği doğrulanamadı.");
    }
  }

  try {
    await del(trimmedUrl);
    return true;
  } catch {
    return false;
  }
}
