import { handler, ok } from "@/lib/http";
import { requireUser } from "@/lib/auth";

export type GifItem = { id: string; url: string; preview: string; width: number; height: number };

/**
 * GET /api/gifs?q= — поиск GIF через Tenor v2 (нужен TENOR_API_KEY; без ключа — пусто и disabled: true).
 * Пустой запрос — популярные. Ключ не уходит в браузер: запрос проксируется сервером.
 */
export const GET = handler(async (req) => {
  await requireUser();
  const key = process.env.TENOR_API_KEY;
  if (!key) return ok({ items: [] as GifItem[], disabled: true });
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  const params = new URLSearchParams({ key, client_key: "bailanysta", limit: "24", media_filter: "gif,tinygif", contentfilter: "medium", locale: "ru_RU" });
  if (q) params.set("q", q);
  const res = await fetch(`https://tenor.googleapis.com/v2/${q ? "search" : "featured"}?${params}`, { signal: AbortSignal.timeout(8000), next: { revalidate: 60 } });
  if (!res.ok) return ok({ items: [] as GifItem[], disabled: false, error: `tenor ${res.status}` });
  const data = (await res.json()) as { results?: Array<{ id: string; media_formats: Record<string, { url: string; dims: [number, number] }> }> };
  const items: GifItem[] = (data.results ?? []).flatMap((r) => {
    const gif = r.media_formats.gif, tiny = r.media_formats.tinygif ?? gif;
    return gif ? [{ id: r.id, url: gif.url, preview: tiny.url, width: gif.dims[0], height: gif.dims[1] }] : [];
  });
  return ok({ items, disabled: false });
});
