import { handler, ok } from "@/lib/http";
import { socialGraph } from "@/lib/repo";

/** Граф подписок для «Шоқжұлдыз» (созвездия связей). */
export const GET = handler(async () => ok(await socialGraph()));
