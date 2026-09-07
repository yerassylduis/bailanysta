import { and, eq, inArray, or, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Galaxy, User } from "@/db/schema";
import { HttpError, isAdmin } from "./auth";
import { communities } from "./communities";
import { newId, nowIso } from "./ids";
import type { GalaxyDto, GalaxyLinkDto } from "./types";

const { users, galaxies, galaxyLinks, media } = schema;

export const GALAXY_NAME_MAX = 40;
export const GALAXY_LINK_MAX = 160;

export const toGalaxyDto = (g: Galaxy, members: number): GalaxyDto => ({ id: g.id, name: g.name, avatarUrl: g.avatarUrl ?? null, members });
export const toGalaxyLinkDto = (l: typeof galaxyLinks.$inferSelect): GalaxyLinkDto => ({ id: l.id, from: l.fromId, to: l.toId, description: l.description, createdBy: l.createdBy });

/**
 * Назначает галактики: сообщества по подпискам → у кого галактики ещё нет, получает галактику
 * большинства своего сообщества (или новую). Уже назначенная галактика сохраняется — это группа/отдел,
 * а не пересчитываемый кластер. Одиночки без связей остаются без галактики («Новые звёзды»).
 */
export async function ensureGalaxies(us: User[], links: Array<{ source: string; target: string }>, followers: Map<string, number>) {
  const db = await getDb();
  const existing = await db.select().from(galaxies);
  const gmap = new Map(existing.map((g) => [g.id, g]));
  const current = new Map<string, string | null>(us.map((u) => [u.id, u.galaxyId && gmap.has(u.galaxyId) ? u.galaxyId : null]));
  const byId = new Map(us.map((u) => [u.id, u]));
  const comm = communities(us.map((u) => u.id), links);
  const groups = new Map<number, string[]>();
  for (const [id, l] of comm) if (l !== -1) groups.set(l, [...(groups.get(l) ?? []), id]);

  const assign: Array<[string, string]> = [];
  for (const members of groups.values()) {
    const votes = new Map<string, number>();
    for (const m of members) { const g = current.get(m); if (g) votes.set(g, (votes.get(g) ?? 0) + 1); }
    let gid = [...votes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (!gid) {
      const top = members.map((m) => byId.get(m)!).sort((a, b) => (followers.get(b.id) ?? 0) - (followers.get(a.id) ?? 0))[0];
      const g: Galaxy = { id: newId(), name: `Галактика @${top.handle}`, avatarUrl: null, createdBy: null, createdAt: nowIso(), updatedAt: nowIso() };
      await db.insert(galaxies).values(g);
      gmap.set(g.id, g); gid = g.id;
    }
    for (const m of members) if (!current.get(m)) { current.set(m, gid); assign.push([m, gid]); }
  }
  for (const [uid, gid] of assign) await db.update(users).set({ galaxyId: gid }).where(eq(users.id, uid));

  const counts = new Map<string, number>();
  for (const g of current.values()) if (g) counts.set(g, (counts.get(g) ?? 0) + 1);
  const list = [...gmap.values()].filter((g) => counts.has(g.id)).map((g) => toGalaxyDto(g, counts.get(g.id)!));
  const glinks = list.length ? await db.select().from(galaxyLinks).where(and(inArray(galaxyLinks.fromId, list.map((g) => g.id)), inArray(galaxyLinks.toId, list.map((g) => g.id)))) : [];
  return { galaxyOf: current, galaxies: list, galaxyLinks: glinks.map(toGalaxyLinkDto) };
}

async function getGalaxy(id: string) {
  const db = await getDb();
  const [g] = await db.select().from(galaxies).where(eq(galaxies.id, id)).limit(1);
  if (!g) throw new HttpError(404, "Галактика не найдена");
  return g;
}

/** Изменять галактику может любой её участник или администратор. */
function assertMember(user: User, galaxyId: string) {
  if (isAdmin(user) || user.galaxyId === galaxyId) return;
  throw new HttpError(403, "Изменять галактику могут только её участники");
}

export async function updateGalaxy(user: User, id: string, patch: { name?: string; avatarMediaId?: string | null }) {
  const db = await getDb();
  await getGalaxy(id);
  assertMember(user, id);
  const set: Partial<Galaxy> = { updatedAt: nowIso() };
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.avatarMediaId !== undefined) {
    if (patch.avatarMediaId === null) set.avatarUrl = null;
    else {
      const [m] = await db.select().from(media).where(and(eq(media.id, patch.avatarMediaId), eq(media.ownerId, user.id))).limit(1);
      if (!m) throw new HttpError(404, "Файл не найден");
      if (m.kind !== "image") throw new HttpError(400, "Аватар галактики должен быть изображением");
      set.avatarUrl = m.url;
    }
  }
  await db.update(galaxies).set(set).where(eq(galaxies.id, id));
  const [cnt] = await db.select({ n: sql<number>`count(*)` }).from(users).where(eq(users.galaxyId, id));
  return toGalaxyDto(await getGalaxy(id), Number(cnt?.n ?? 0));
}

/** Связь между галактиками создаёт участник любой из двух галактик (или админ). */
export async function linkGalaxies(user: User, fromId: string, toId: string, description: string) {
  const db = await getDb();
  if (fromId === toId) throw new HttpError(400, "Галактику нельзя связать с самой собой");
  await getGalaxy(fromId); await getGalaxy(toId);
  if (!isAdmin(user) && user.galaxyId !== fromId && user.galaxyId !== toId) throw new HttpError(403, "Связь может создать только участник одной из галактик");
  const [dup] = await db.select().from(galaxyLinks).where(or(and(eq(galaxyLinks.fromId, fromId), eq(galaxyLinks.toId, toId)), and(eq(galaxyLinks.fromId, toId), eq(galaxyLinks.toId, fromId)))).limit(1);
  if (dup) throw new HttpError(409, "Эти галактики уже связаны — удалите старую связь, чтобы описать иначе");
  const row = { id: newId(), fromId, toId, description, createdBy: user.id, createdAt: nowIso() };
  await db.insert(galaxyLinks).values(row);
  return toGalaxyLinkDto(row);
}

export async function unlinkGalaxies(user: User, linkId: string) {
  const db = await getDb();
  const [l] = await db.select().from(galaxyLinks).where(eq(galaxyLinks.id, linkId)).limit(1);
  if (!l) throw new HttpError(404, "Связь не найдена");
  if (!isAdmin(user) && l.createdBy !== user.id && user.galaxyId !== l.fromId && user.galaxyId !== l.toId) throw new HttpError(403, "Удалить связь может её автор или участник галактики");
  await db.delete(galaxyLinks).where(eq(galaxyLinks.id, linkId));
}
