import { randomUUID } from "node:crypto";
import { Buffer } from "node:buffer";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { extname, join, posix } from "node:path";

import { resolveFromAppRoot } from "./runtime-paths";

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

  const extension = extname(file.name).toLowerCase();
  if (ALLOWED_EXTENSIONS.has(extension)) {
    return extension === ".jpeg" ? ".jpg" : extension;
  }

  return null;
}

export async function saveProductImageUpload(file: File) {
  if (file.size <= 0) {
    throw new Error("Boş dosya yüklenemez.");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error("Görsel boyutu 5 MB sınırını aşmamalı.");
  }

  const extension = resolveExtension(file);
  if (!extension) {
    throw new Error("Sadece JPG, PNG, WebP veya GIF yüklenebilir.");
  }

  const uploadDirectory = resolveFromAppRoot("public", "uploads", "products");
  await mkdir(uploadDirectory, { recursive: true });

  const fileName = `${Date.now()}-${randomUUID()}${extension}`;
  const absolutePath = join(uploadDirectory, fileName);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(absolutePath, buffer);

  return {
    url: `/uploads/products/${fileName}`,
    fileName,
  };
}

export async function deleteProductImageUpload(imageUrl: string) {
  const trimmedUrl = imageUrl.trim();
  if (!trimmedUrl) {
    return false;
  }

  let pathname: string;
  try {
    pathname = new URL(trimmedUrl, "http://localhost").pathname;
  } catch {
    return false;
  }

  const normalizedPath = posix.normalize(pathname);
  if (normalizedPath !== pathname || !normalizedPath.startsWith("/uploads/products/")) {
    return false;
  }

  const absolutePath = resolveFromAppRoot("public", ...normalizedPath.split("/").filter(Boolean));

  try {
    await unlink(absolutePath);
    return true;
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "ENOENT") {
      return false;
    }

    throw error;
  }
}
