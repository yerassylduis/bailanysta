import { z } from "zod";
import { handler, ok, parseBody } from "@/lib/http";
import { currentUser, requireUser } from "@/lib/auth";
import { toMeDto, unreadCount, updateProfile } from "@/lib/repo";
import { normalizeTarget } from "@/lib/otp";
import { unreadMessagesCount } from "@/lib/repo-messages";

/** Текущий пользователь + число непрочитанных уведомлений (для шапки). */
export const GET = handler(async () => {
  const user = await currentUser();
  if (!user) return ok({ user: null, unread: 0, unreadMessages: 0 });
  const me = toMeDto(user);
  if (me.banned) return ok({ user: me, unread: 0, unreadMessages: 0 });
  const [unread, unreadMessages] = await Promise.all([unreadCount(user.id), unreadMessagesCount(user.id)]);
  return ok({ user: me, unread, unreadMessages });
});

const Patch = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  bio: z.string().trim().max(200).optional(),
  /** id загруженного изображения или null, чтобы убрать аватар */
  avatarMediaId: z.string().nullable().optional(),
  /** обложка: своя картинка (id медиа) ИЛИ встроенный градиент (0..5); null — сбросить */
  coverMediaId: z.string().nullable().optional(),
  coverPreset: z.number().int().min(0).max(5).nullable().optional(),
  phone: z.string().trim().min(10).optional(),
  email: z.string().trim().min(5).optional(),
  birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const PATCH = handler(async (req) => {
  const user = await requireUser();
  const patch = await parseBody(req, Patch);
  if (patch.phone !== undefined) { const t = normalizeTarget(patch.phone); if (t.channel !== "sms") throw new Error("phone"); patch.phone = t.target; }
  if (patch.email !== undefined) { const t = normalizeTarget(patch.email); if (t.channel !== "email") throw new Error("email"); patch.email = t.target; }
  return ok({ user: toMeDto(await updateProfile(user.id, patch)) });
});
