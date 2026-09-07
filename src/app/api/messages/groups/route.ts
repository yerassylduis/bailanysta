import { z } from "zod";
import { handler, ok, parseBody } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { createGroup } from "@/lib/repo-messages";

/** POST /api/messages/groups { title, handles[] } — создать групповой чат. */
export const POST = handler(async (req) => {
  const user = await requireUser();
  const { title, handles } = await parseBody(req, z.object({ title: z.string().trim().min(1).max(60), handles: z.array(z.string().trim().toLowerCase()).min(1).max(30) }));
  return ok(await createGroup(user, title, handles), { status: 201 });
});
