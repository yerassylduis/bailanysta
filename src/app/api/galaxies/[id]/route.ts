import { z } from "zod";
import { handler, ok, parseBody, type RouteCtx } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { GALAXY_NAME_MAX, updateGalaxy } from "@/lib/repo-galaxies";

type Ctx = RouteCtx<{ id: string }>;

const Patch = z.object({
  name: z.string().trim().min(2).max(GALAXY_NAME_MAX).optional(),
  /** id загруженного изображения; null — убрать аватар */
  avatarMediaId: z.string().nullable().optional(),
});

/** PATCH /api/galaxies/:id — имя и аватар галактики (любой участник). */
export const PATCH = handler<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const user = await requireUser();
  return ok(await updateGalaxy(user, id, await parseBody(req, Patch)));
});
