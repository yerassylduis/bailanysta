import fs from "node:fs";
import path from "node:path";
import { MEDIA_DIR, safeName } from "@/lib/storage";
import type { RouteCtx } from "@/lib/http";

const MIME: Record<string, string> = {
  jpg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", avif: "image/avif",
  mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime",
  weba: "audio/webm", ogg: "audio/ogg", m4a: "audio/mp4", mp3: "audio/mpeg", wav: "audio/wav", aac: "audio/aac",
};

/** Отдаёт локально сохранённые файлы. Поддерживает Range — иначе Safari не проигрывает видео. */
export async function GET(req: Request, { params }: RouteCtx<{ file: string }>) {
  const { file } = await params;
  const name = safeName(file);
  if (!name) return new Response("Not found", { status: 404 });
  const full = path.join(MEDIA_DIR, name);
  let stat: fs.Stats;
  try { stat = await fs.promises.stat(full); } catch { return new Response("Not found", { status: 404 }); }

  const type = MIME[name.split(".").pop()!] ?? "application/octet-stream";
  const headers: Record<string, string> = {
    "content-type": type,
    "cache-control": "public, max-age=31536000, immutable",
    "accept-ranges": "bytes",
  };

  const range = req.headers.get("range");
  let start = 0, end = stat.size - 1, status = 200;
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    if (m) {
      if (m[1]) start = Number(m[1]);
      if (m[2]) end = Math.min(Number(m[2]), stat.size - 1);
      if (!m[1] && m[2]) { start = Math.max(0, stat.size - Number(m[2])); end = stat.size - 1; }
      if (start > end || start >= stat.size) return new Response(null, { status: 416, headers: { "content-range": `bytes */${stat.size}` } });
      status = 206;
      headers["content-range"] = `bytes ${start}-${end}/${stat.size}`;
    }
  }
  headers["content-length"] = String(end - start + 1);
  const stream = fs.createReadStream(full, { start, end });
  const body = new ReadableStream({
    start(controller) {
      stream.on("data", (chunk) => controller.enqueue(new Uint8Array(chunk as Buffer)));
      stream.on("end", () => controller.close());
      stream.on("error", (e) => controller.error(e));
    },
    cancel() { stream.destroy(); },
  });
  return new Response(body, { status, headers });
}
