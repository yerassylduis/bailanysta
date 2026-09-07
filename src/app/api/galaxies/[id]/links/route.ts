import { z } from "zod";
import { handler, ok, parseBody, type RouteCtx } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { GALAXY_LINK_MAX, linkGalaxies } from "@/lib/repo-galaxies";

type Ctx = RouteCtx<{ id: string }>;

const Body = z.object({ toId: z.string().min(1), description: z.string().trim().min(2).max(GALAXY_LINK_MAX) });

/** POST /api/galaxies/:id/links — связать галактику с другой и описать, чем связаны. */
export const POST = handler<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const user = await requireUser();
  const b = await parseBody(req, Body);
  return ok(await linkGalaxies(user, id, b.toId, b.description), { status: 201 });
});
