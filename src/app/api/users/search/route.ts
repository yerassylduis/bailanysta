import { handler, ok } from "@/lib/http";
import { searchUsers } from "@/lib/repo";

export const GET = handler(async (req) => {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 1) return ok({ items: [] });
  return ok({ items: await searchUsers(q.replace(/^@/, "")) });
});
