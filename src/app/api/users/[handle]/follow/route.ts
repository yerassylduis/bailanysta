import { z } from "zod";
import { handler, ok, parseBody, type RouteCtx } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { setFollow } from "@/lib/repo";

/** PUT /api/users/:handle/follow { follow: boolean } */
export const PUT = handler<RouteCtx<{ handle: string }>>(async (req, { params }) => {
  const { handle } = await params;
  const user = await requireUser();
  const { follow } = await parseBody(req, z.object({ follow: z.boolean() }));
  return ok(await setFollow(user, handle.toLowerCase(), follow));
});
