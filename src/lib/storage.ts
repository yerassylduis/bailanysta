import fs from "node:fs/promises";
import path from "node:path";

/**
 * Хранилище файлов с двумя драйверами:
 *  - Vercel Blob, если задан BLOB_READ_WRITE_TOKEN (постоянное хранение, CDN);
 *  - локальный диск (./data/media, на Vercel без токена — эфемерный /tmp), файлы отдаёт /api/media/[file].
 * Вызывается только с сервера.
 */

export const MEDIA_DIR = process.env.MEDIA_DIR ?? (process.env.VERCEL ? "/tmp/bailanysta-media" : path.resolve("./data/media"));

export const IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);
export const VIDEO_MIMES = new Set(["video/mp4", "video/webm", "video/quicktime"]);
export const AUDIO_MIMES = new Set(["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav", "audio/x-m4a", "audio/aac"]);
export const MAX_AUDIO_BYTES = 15 * 1024 * 1024;
/** Документы для чата. На Vercel тело запроса ограничено 4,5 МБ. */
export const DOC_MIMES = new Set([
  "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain", "text/csv", "application/zip", "application/x-zip-compressed", "application/json", "text/markdown",
]);
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_VIDEO_BYTES = Number(process.env.MAX_VIDEO_MB ?? 60) * 1024 * 1024;

const EXT: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif",
  "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov",
  "application/pdf": "pdf", "application/msword": "doc", "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt", "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "text/plain": "txt", "text/csv": "csv", "application/zip": "zip", "application/x-zip-compressed": "zip", "application/json": "json", "text/markdown": "md",
  "audio/webm": "weba", "audio/ogg": "ogg", "audio/mp4": "m4a", "audio/mpeg": "mp3", "audio/wav": "wav", "audio/x-m4a": "m4a", "audio/aac": "aac",
};

export function extFor(mime: string) { return EXT[mime] ?? "bin"; }

export async function saveFile(id: string, mime: string, buf: Buffer): Promise<string> {
  const name = `${id}.${extFor(mime)}`;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    const res = await put(`media/${name}`, buf, { access: "public", contentType: mime, addRandomSuffix: false });
    return res.url;
  }
  await fs.mkdir(MEDIA_DIR, { recursive: true });
  await fs.writeFile(path.join(MEDIA_DIR, name), buf);
  return `/api/media/${name}`;
}

/** Безопасное имя файла: только id.ext, без путей. */
export function safeName(name: string) {
  return /^[a-z0-9]{6,32}\.[a-z0-9]{2,5}$/.test(name) ? name : null;
}
