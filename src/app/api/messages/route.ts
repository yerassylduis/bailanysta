import { handler, ok } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { ensureWelcome, listConversations } from "@/lib/repo-messages";

/** GET /api/messages — диалоги текущего пользователя с последним сообщением и числом непрочитанных. */
export const GET = handler(async () => {
  const user = await requireUser();
  await ensureWelcome(user); // у каждого есть диалог с помощником — даже если вошёл до его появления
  return ok({ items: await listConversations(user.id) });
});
