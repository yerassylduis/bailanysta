import { z } from "zod";
import { handler, ok, parseBody, type RouteCtx } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { adminDeleteUser, adminGetUser, adminUpdateUser } from "@/lib/repo-admin";
import { toMeDto } from "@/lib/repo";

type Ctx = RouteCtx<{ id: string }>;
const Patch = z.object({
  handle: z.string().trim().optional(), name: z.string().trim().optional(), bio: z.string().trim().max(200).optional(),
  email: z.string().trim().nullable().optional(), phone: z.string().trim().nullable().optional(), birthday: z.string().nullable().optional(),
  role: z.enum(["user", "admin"]).optional(),
});

export const GET = handler<Ctx>(async (_req, { params }) => { await requireAdmin(); const { id } = await params; return ok(toMeDto(await adminGetUser(id))); });
export const PATCH = handler<Ctx>(async (req, { params }) => { const admin = await requireAdmin(); const { id } = await params; return ok(await adminUpdateUser(admin, id, await parseBody(req, Patch))); });
export const DELETE = handler<Ctx>(async (_req, { params }) => { const admin = await requireAdmin(); const { id } = await params; return ok(await adminDeleteUser(admin, id)); });
