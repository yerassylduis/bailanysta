import { z } from "zod";
import { handler, ok, parseBody } from "@/lib/http";
import { currentUser, requireUser } from "@/lib/auth";
import { toUserDto, unreadCount, updateProfile } from "@/lib/repo";

/** Текущий пользователь + число непрочитанных уведомлений (для шапки). */
export const GET = handler(async () => {
  const user = await currentUser();
  if (!user) return ok({ user: null, unread: 0 });
  return ok({ user: toUserDto(user), unread: await unreadCount(user.id) });
});

const Patch = z.object({ name: z.string().trim().min(1).max(60).optional(), bio: z.string().trim().max(200).optional() });

export const PATCH = handler(async (req) => {
  const user = await requireUser();
  const patch = await parseBody(req, Patch);
  return ok({ user: toUserDto(await updateProfile(user.id, patch)) });
});
