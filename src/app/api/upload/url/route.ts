import { z } from "zod";
import { handler, ok, parseBody } from "@/lib/http";
import { HttpError, requireUser } from "@/lib/auth";
import { IMAGE_MIMES, MAX_IMAGE_BYTES, saveFile } from "@/lib/storage";
import { createMedia } from "@/lib/repo";
import { newId } from "@/lib/ids";

/** Откуда можно тянуть GIF по ссылке (пикер GIF). */
const ALLOWED_HOSTS = ["media.tenor.com", "media1.tenor.com", "c.tenor.com", "media.giphy.com", "media0.giphy.com", "media1.giphy.com", "media2.giphy.com", "media3.giphy.com", "media4.giphy.com"];

/** POST /api/upload/url { url } — сервер скачивает GIF с доверенного хоста и сохраняет как обычное медиа. */
export const POST = handler(async (req) => {
  const user = await requireUser();
  const { url } = await parseBody(req, z.object({ url: z.string().url() }));
  const u = new URL(url);
  if (u.protocol !== "https:" || !ALLOWED_HOSTS.includes(u.hostname)) throw new HttpError(400, "Разрешены только ссылки Tenor/Giphy");
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new HttpError(502, "Не удалось скачать GIF");
  const mime = (res.headers.get("content-type") ?? "").split(";")[0].trim();
  if (!IMAGE_MIMES.has(mime)) throw new HttpError(415, "По ссылке не картинка");
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > MAX_IMAGE_BYTES) throw new HttpError(413, "GIF слишком большой");
  const id = newId();
  const saved = await saveFile(id, mime, buf);
  return ok(await createMedia({ id, ownerId: user.id, kind: "image", mime, size: buf.byteLength, width: null, height: null, url: saved, durationMs: null, fileName: null }), { status: 201 });
});
