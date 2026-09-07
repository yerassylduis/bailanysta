import { handler, ok, type RouteCtx } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { unlinkGalaxies } from "@/lib/repo-galaxies";

type Ctx = RouteCtx<{ linkId: string }>;

/** DELETE /api/galaxies/links/:linkId — убрать связь между галактиками. */
export const DELETE = handler<Ctx>(async (_req, { params }) => {
  const { linkId } = await params;
  await unlinkGalaxies(await requireUser(), linkId);
  return ok({ ok: true });
});
