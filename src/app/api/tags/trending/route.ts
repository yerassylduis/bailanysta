import { handler, ok } from "@/lib/http";
import { trendingTags } from "@/lib/repo";

export const GET = handler(async () => ok({ items: await trendingTags() }));
