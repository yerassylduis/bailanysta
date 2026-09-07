import { handler, ok } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { adminLogList } from "@/lib/repo-admin";
export const GET = handler(async () => { await requireAdmin(); return ok({ items: await adminLogList() }); });
