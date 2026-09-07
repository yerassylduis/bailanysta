import { z } from "zod";
import { handler, ok, parseBody } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { createCall, listMyCalls } from "@/lib/repo-calls";

/** GET /api/calls — мои звонки; POST { title? } — создать комнату. */
export const GET = handler(async () => {
  const user = await requireUser();
  return ok({ items: await listMyCalls(user.id) });
});

export const POST = handler(async (req) => {
  const user = await requireUser();
  const { title } = await parseBody(req, z.object({ title: z.string().trim().max(80).optional() }));
  return ok(await createCall(user, title ?? ""), { status: 201 });
});
