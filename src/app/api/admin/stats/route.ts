import { handler, ok } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { adminStats } from "@/lib/repo-admin";
export const GET = handler(async () => { await requireAdmin(); return ok(await adminStats()); });
