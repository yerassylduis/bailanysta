import { z } from "zod";
import { handler, ok, parseBody, type RouteCtx } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { adminBan, adminUnban } from "@/lib/repo-admin";

/** POST { days: number|null, reason } — бан (null = навсегда) · DELETE — разбан */
export const POST = handler<RouteCtx<{ id: string }>>(async (req, { params }) => {
  const admin = await requireAdmin(); const { id } = await params;
  const { days, reason } = await parseBody(req, z.object({ days: z.number().int().min(1).max(3650).nullable(), reason: z.string().trim().max(200).default("") }));
  return ok(await adminBan(admin, id, days, reason));
});
export const DELETE = handler<RouteCtx<{ id: string }>>(async (_req, { params }) => {
  const admin = await requireAdmin(); const { id } = await params;
  return ok(await adminUnban(admin, id));
});
