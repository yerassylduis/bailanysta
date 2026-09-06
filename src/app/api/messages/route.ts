import { handler, ok } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { listConversations } from "@/lib/repo-messages";

/** GET /api/messages — диалоги текущего пользователя с последним сообщением и числом непрочитанных. */
export const GET = handler(async () => {
  const user = await requireUser();
  return ok({ items: await listConversations(user.id) });
});
