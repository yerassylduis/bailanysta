import { handler, ok, type RouteCtx } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { adminDeletePost } from "@/lib/repo-admin";
export const DELETE = handler<RouteCtx<{ id: string }>>(async (_req, { params }) => { const admin = await requireAdmin(); const { id } = await params; return ok(await adminDeletePost(admin, id)); });
