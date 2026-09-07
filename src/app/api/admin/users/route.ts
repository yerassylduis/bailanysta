import { z } from "zod";
import { handler, ok, parseBody } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { adminCreateUser, adminListUsers } from "@/lib/repo-admin";

/** GET /api/admin/users?q=&page=&filter=all|banned|admins · POST — создать пользователя вручную */
export const GET = handler(async (req) => {
  await requireAdmin();
  const p = new URL(req.url).searchParams;
  const filter = (["all", "banned", "admins"] as const).find((f) => f === p.get("filter")) ?? "all";
  return ok(await adminListUsers(p.get("q") ?? "", Math.max(1, Number(p.get("page") ?? 1) || 1), 25, filter));
});

const Body = z.object({
  handle: z.string().trim(), name: z.string().trim(), bio: z.string().trim().max(200).optional(),
  email: z.string().trim().nullable().optional(), phone: z.string().trim().nullable().optional(), birthday: z.string().nullable().optional(),
  role: z.enum(["user", "admin"]).optional(),
});
export const POST = handler(async (req) => {
  const admin = await requireAdmin();
  return ok(await adminCreateUser(admin, await parseBody(req, Body)), { status: 201 });
});
