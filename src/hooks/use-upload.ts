"use client";

import { currentLocale, translate } from "@/lib/i18n";
import { useCallback, useState } from "react";
import { api } from "@/lib/api-client";
import type { MediaDto } from "@/lib/types";

/**
 * Загрузка медиа: фото сжимаются в браузере (до 1920px, WebP/JPEG ~85%),
 * чтобы не упираться в лимиты тела запроса на serverless; видео уходит как есть.
 */
export type Attachment = { localId: string; kind: MediaDto["kind"]; name?: string; preview: string; progress: number; media: MediaDto | null; error: string | null };

const MAX_SIDE = 1920;

async function compressImage(file: File, maxSide = MAX_SIDE): Promise<{ blob: Blob; width: number; height: number }> {
  if (file.type === "image/gif") {
    const dims = await imageDims(file);
    return { blob: file, ...dims };
  }
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) { const dims = await imageDims(file); return { blob: file, ...dims }; }
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  const hasAlpha = file.type === "image/png";
  const type = hasAlpha ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, type, 0.86));
  return { blob: blob && blob.size < file.size ? blob : file, width: w, height: h };
}

function imageDims(file: File) {
  return new Promise<{ width: number; height: number }>((resolve) => {
    const img = new Image();
    img.onload = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(img.src); };
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = URL.createObjectURL(file);
  });
}

export function useUpload(limits: { images: number; videos: number; files?: number } = { images: 4, videos: 1 }, opts: { maxSide?: number } = {}) {
  const maxSide = opts.maxSide ?? MAX_SIDE;
  const [items, setItems] = useState<Attachment[]>([]);

  const patch = (localId: string, p: Partial<Attachment>) => setItems((xs) => xs.map((x) => (x.localId === localId ? { ...x, ...p } : x)));

  const add = useCallback(async (files: FileList | File[]): Promise<MediaDto[]> => {
    const list = Array.from(files);
    const done: MediaDto[] = [];
    for (const file of list) {
      const kind: MediaDto["kind"] | null = file.type.startsWith("video/") ? "video" : file.type.startsWith("image/") ? "image" : file.type.startsWith("audio/") ? "audio" : (limits.files ?? 0) > 0 ? "file" : null;
      if (!kind) continue;
      let blocked = false;
      setItems((xs) => {
        const imgs = xs.filter((x) => x.kind === "image").length, vids = xs.filter((x) => x.kind === "video").length, docs = xs.filter((x) => x.kind === "file" || x.kind === "audio").length;
        if (kind === "file" || kind === "audio") { if (docs >= (limits.files ?? 0) || imgs + vids > 0) blocked = true; return xs; }
        if (docs > 0 || (kind === "video" && (vids >= limits.videos || imgs > 0)) || (kind === "image" && (imgs >= limits.images || vids > 0))) { blocked = true; return xs; }
        return xs;
      });
      if (blocked) continue;
      const localId = Math.random().toString(36).slice(2);
      const preview = URL.createObjectURL(file);
      setItems((xs) => [...xs, { localId, kind, name: file.name, preview, progress: 0, media: null, error: null }]);
      try {
        let blob: Blob = file, dims: { width: number; height: number } | undefined;
        if (kind === "image") { const c = await compressImage(file, maxSide); blob = c.blob; dims = { width: c.width, height: c.height }; }
        const media = await api.upload(blob instanceof File ? blob : new File([blob], file.name, { type: blob.type }), dims, (p) => patch(localId, { progress: p }));
        patch(localId, { media, progress: 1 });
        done.push(media);
      } catch (e) {
        patch(localId, { error: e instanceof Error ? e.message : translate(currentLocale(), "posts.uploadError") });
      }
    }
    return done;
  }, [limits.images, limits.videos, limits.files, maxSide]);

  const remove = useCallback((localId: string) => setItems((xs) => xs.filter((x) => x.localId !== localId)), []);
  const reset = useCallback(() => setItems([]), []);
  const uploading = items.some((x) => !x.media && !x.error);
  const mediaIds = items.filter((x) => x.media).map((x) => x.media!.id);

  return { items, add, remove, reset, uploading, mediaIds, setItems };
}
