import { z } from "zod";
import { handler, ok, parseBody } from "@/lib/http";
import { currentUser, requireUser } from "@/lib/auth";
import { toUserDto, unreadCount, updateProfile } from "@/lib/repo";
import { unreadMessagesCount } from "@/lib/repo-messages";

/** Текущий пользователь + число непрочитанных уведомлений (для шапки). */
export const GET = handler(async () => {
  const user = await currentUser();
  if (!user) return ok({ user: null, unread: 0, unreadMessages: 0 });
  const [unread, unreadMessages] = await Promise.all([unreadCount(user.id), unreadMessagesCount(user.id)]);
  return ok({ user: toUserDto(user), unread, unreadMessages });
});

const Patch = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  bio: z.string().trim().max(200).optional(),
  /** id загруженного изображения или null, чтобы убрать аватар */
  avatarMediaId: z.string().nullable().optional(),
  /** обложка: своя картинка (id медиа) ИЛИ встроенный градиент (0..5); null — сбросить */
  coverMediaId: z.string().nullable().optional(),
  coverPreset: z.number().int().min(0).max(5).nullable().optional(),
});

export const PATCH = handler(async (req) => {
  const user = await requireUser();
  const patch = await parseBody(req, Patch);
  return ok({ user: toUserDto(await updateProfile(user.id, patch)) });
});
