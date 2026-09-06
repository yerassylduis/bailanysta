import { handler, ok } from "@/lib/http";
import { currentUser } from "@/lib/auth";
import { suggestedUsers } from "@/lib/repo";

export const GET = handler(async () => {
  const viewer = await currentUser();
  return ok({ items: await suggestedUsers(viewer?.id ?? null) });
});
