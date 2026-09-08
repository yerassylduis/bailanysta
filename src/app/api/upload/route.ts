import { handler, ok } from "@/lib/http";
import { HttpError, requireUser } from "@/lib/auth";
import { AUDIO_MIMES, DOC_MIMES, IMAGE_MIMES, MAX_AUDIO_BYTES, MAX_FILE_BYTES, MAX_IMAGE_BYTES, MAX_VIDEO_BYTES, VIDEO_MIMES, saveFile } from "@/lib/storage";
import { createMedia } from "@/lib/repo";
import { newId } from "@/lib/ids";

/**
 * POST /api/upload — multipart/form-data: file, width?, height?
 * Принимает фото (≤ 8 МБ) и видео (≤ MAX_VIDEO_MB, по умолчанию 60). На Vercel тело запроса ограничено 4.5 МБ.
 */
export const POST = handler(async (req) => {
  const user = await requireUser();
  const form = await req.formData().catch(() => { throw new HttpError(400, "Ожидается multipart/form-data"); });
  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "Файл не передан");
  const mime = file.type.split(";")[0].trim(); // MediaRecorder отдаёт "audio/webm;codecs=opus"
  const kind = IMAGE_MIMES.has(mime) ? "image" : VIDEO_MIMES.has(mime) ? "video" : AUDIO_MIMES.has(mime) ? "audio" : DOC_MIMES.has(mime) ? "file" : null;
  if (!kind) throw new HttpError(415, "Поддерживаются фото, видео, аудио и документы (PDF, Word, Excel, PowerPoint, TXT, CSV, ZIP)");
  const limit = kind === "image" ? MAX_IMAGE_BYTES : kind === "video" ? MAX_VIDEO_BYTES : kind === "audio" ? MAX_AUDIO_BYTES : MAX_FILE_BYTES;
  if (file.size > limit) throw new HttpError(413, `Файл слишком большой: максимум ${Math.round(limit / 1024 / 1024)} МБ`);

  const id = newId();
  const buf = Buffer.from(await file.arrayBuffer());
  const url = await saveFile(id, mime, buf);
  const w = Number(form.get("width")) || null;
  const h = Number(form.get("height")) || null;
  const durationMs = Math.round(Number(form.get("durationMs"))) || null;
  const fileName = kind === "file" ? file.name.replace(/[\r\n\t]/g, " ").slice(0, 120) || null : null;
  const dto = await createMedia({ id, ownerId: user.id, kind, mime, size: file.size, width: w, height: h, url, durationMs, fileName });
  return ok(dto, { status: 201 });
});
