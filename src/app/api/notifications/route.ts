import { handler, ok } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { listNotifications, markAllRead } from "@/lib/repo";

export const GET = handler(async () => {
  const user = await requireUser();
  return ok(await listNotifications(user.id));
});

/** POST /api/notifications — отметить все прочитанными. */
export const POST = handler(async () => {
  const user = await requireUser();
  await markAllRead(user.id);
  return ok({ ok: true });
});
