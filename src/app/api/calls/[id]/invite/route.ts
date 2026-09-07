import { z } from "zod";
import { handler, ok, parseBody, type RouteCtx } from "@/lib/http";
import { HttpError, requireUser } from "@/lib/auth";
import { getCall } from "@/lib/repo-calls";
import { sendMessage } from "@/lib/repo-messages";
import { findUserByHandle, pushNotification } from "@/lib/repo";

/**
 * POST /api/calls/:id/invite { handle } — пригласить человека в созвон.
 * Приглашение уходит личным сообщением со ссылкой: адресат получит его в реальном времени
 * (всплывашка + звук) и сможет войти одним нажатием.
 */
export const POST = handler<RouteCtx<{ id: string }>>(async (req, { params }) => {
  const { id } = await params;
  const user = await requireUser();
  const { handle } = await parseBody(req, z.object({ handle: z.string().trim().toLowerCase().min(2) }));
  const call = await getCall(id);
  if (call.endedAt) throw new HttpError(410, "Звонок завершён");
  const target = await findUserByHandle(handle);
  if (!target) throw new HttpError(404, "Пользователь не найден");
  if (target.id === user.id) throw new HttpError(400, "Себя приглашать не нужно 🙂");
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? new URL(req.url).host;
  const link = `${proto}://${host}/calls/${id}`;
  await sendMessage(user, target.handle, `📞 Приглашаю в созвон «${call.title}»: ${link}`, null);
  // Отдельное уведомление с действием — в списке уведомлений и во всплывашке будет кнопка «Присоединиться»
  await pushNotification({ userId: target.id, actorId: user.id, type: "call_invite", postId: null, link: `/calls/${id}` });
  return ok({ ok: true, invited: target.handle });
});
