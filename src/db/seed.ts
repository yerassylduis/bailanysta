import { count } from "drizzle-orm";
import type { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";
import { newId } from "@/lib/ids";
import { extractTags, hueFromHandle } from "@/lib/text";
import { BOT_PROFILE } from "@/lib/bot";

type Db = ReturnType<typeof drizzle<typeof schema>>;

/**
 * Демо-данные: небольшая «степная» община авторов, чтобы лента не была пустой
 * при первом запуске. Выполняется один раз, когда таблица users пуста.
 */
const DEMO_USERS = [
  { handle: "aisha", name: "Айша Нурлан", bio: "Пишу о степи, дизайне и тишине. Алматы ⛰" },
  { handle: "daniyar", name: "Данияр Ахмет", bio: "ML-инженер. Учу нейросети говорить по-казахски." },
  { handle: "tomiris", name: "Томирис Сейт", bio: "Продукт, люди, кофе. Ищу смысл в бэклоге." },
  { handle: "arman", name: "Арман Бек", bio: "Фотограф. Ловлю свет между Астаной и Тянь-Шанем." },
  { handle: "saule", name: "Сәуле Қайрат", bio: "Пишу стихи и код — иногда одновременно." },
  { handle: "nursultan", name: "Нурсултан Ж.", bio: "Основатель nFactorial-мечты. Люблю ранние утра." },
];

const DEMO_POSTS: Array<{ by: string; text: string; mood: string | null; hoursAgo: number }> = [
  { by: "aisha", text: "Степь учит одному: пространство — это не пустота, а возможность. #степь #дизайн", mood: "oi", hoursAgo: 2 },
  { by: "daniyar", text: "Дообучил модель на казахских новостях — и она начала шутить лучше меня. Тревожно и прекрасно. #ml #qazaq", mood: "zhalyn", hoursAgo: 5 },
  { by: "tomiris", text: "Идея: продукт без онбординга, где первое действие пользователя и есть онбординг. Кто уже так делал? #продукт #идея", mood: "idea", hoursAgo: 7 },
  { by: "arman", text: "Свет в Бурабае в шесть утра — как будто кто-то включил лампу под озером. Снимал без фильтров. #фото #бурабай", mood: "tynysh", hoursAgo: 9 },
  { by: "saule", text: "Кодтың ішінде де ырғақ бар. Функция — шумақ, айнымалы — ұйқас. #поэзия #код", mood: "oi", hoursAgo: 13 },
  { by: "nursultan", text: "Самый недооценённый навык инженера — умение задавать вопрос, на который ещё нет ответа. #nfactorial #обучение", mood: "idea", hoursAgo: 20 },
  { by: "aisha", text: "Сделала мудборд для нового проекта: охра, бирюза, ночное небо. Кажется, это цвета Expert Bailanysta. #дизайн #цвет", mood: "zhalyn", hoursAgo: 26 },
  { by: "daniyar", text: "@tomiris твоя идея про онбординг — это же по сути «нулевой клик». Давай обсудим на созвоне? #продукт", mood: null, hoursAgo: 30 },
  { by: "arman", text: "Тишина в горах громче любого города. #тынысh #горы", mood: "tynysh", hoursAgo: 40 },
  { by: "tomiris", text: "Провели ретро: главный вывод — меньше встреч, больше письменных решений. #команда #продукт", mood: "oi", hoursAgo: 50 },
  { by: "saule", text: "Айналайын, түн. Жұлдыздар — біздің ескі байланыс желіміз. #түн #поэзия", mood: "tynysh", hoursAgo: 60 },
  { by: "nursultan", text: "Новая когорта стартует. Волнуюсь как в первый раз. Идите учиться — это всегда окупается. #nfactorial", mood: "zhalyn", hoursAgo: 75 },
];

const DEMO_FOLLOWS: Array<[string, string]> = [
  ["aisha", "daniyar"], ["aisha", "arman"], ["aisha", "saule"],
  ["daniyar", "aisha"], ["daniyar", "tomiris"], ["daniyar", "nursultan"],
  ["tomiris", "daniyar"], ["tomiris", "nursultan"],
  ["arman", "aisha"], ["arman", "saule"],
  ["saule", "aisha"], ["saule", "arman"], ["saule", "tomiris"],
  ["nursultan", "daniyar"], ["nursultan", "tomiris"], ["nursultan", "aisha"],
];

export async function seedIfEmpty(db: Db) {
  const [{ n }] = await db.select({ n: count() }).from(schema.users);
  if (n > 0) return;

  const now = Date.now();
  const ids = new Map<string, string>();
  for (const u of DEMO_USERS) {
    const id = newId();
    ids.set(u.handle, id);
    await db.insert(schema.users).values({
      id, handle: u.handle, name: u.name, bio: u.bio, hue: hueFromHandle(u.handle),
      createdAt: new Date(now - 1000 * 60 * 60 * 24 * 30).toISOString(),
    });
  }

  const postIds: string[] = [];
  for (const p of DEMO_POSTS) {
    const id = newId();
    postIds.push(id);
    const createdAt = new Date(now - p.hoursAgo * 3600_000).toISOString();
    await db.insert(schema.posts).values({ id, authorId: ids.get(p.by)!, text: p.text, mood: p.mood, createdAt });
    const tags = extractTags(p.text);
    if (tags.length) await db.insert(schema.postTags).values(tags.map((tag) => ({ postId: id, tag })));
  }

  for (const [a, b] of DEMO_FOLLOWS) {
    await db.insert(schema.follows).values({ followerId: ids.get(a)!, followeeId: ids.get(b)!, createdAt: new Date(now - 86400_000 * 10).toISOString() });
  }

  // Лайки: детерминированный узор, чтобы у постов были разные счётчики.
  const userIds = [...ids.values()];
  for (let i = 0; i < postIds.length; i++) {
    for (let j = 0; j < userIds.length; j++) {
      if ((i + j) % 3 === 0 || (i * j) % 5 === 1) {
        await db.insert(schema.likes).values({ userId: userIds[j], postId: postIds[i], createdAt: new Date(now - (i + j) * 3600_000).toISOString() }).onConflictDoNothing();
      }
    }
  }

  const demoComments: Array<[number, string, string]> = [
    [0, "daniyar", "Пространство как возможность — забираю в презентацию."],
    [0, "saule", "Кең дала — кең жүрек."],
    [1, "tomiris", "Скинь пример шутки, пожалуйста 😄"],
    [2, "daniyar", "Так делает хороший поиск: строка — и есть весь продукт."],
    [3, "aisha", "Какой объектив?"],
    [5, "saule", "Вопрос без ответа — это уже половина стиха."],
  ];
  for (const [pi, by, text] of demoComments) {
    await db.insert(schema.comments).values({ id: newId(), postId: postIds[pi], authorId: ids.get(by)!, text, createdAt: new Date(now - pi * 3000_000).toISOString() });
  }
}

/** Бот-помощник должен существовать всегда — и в свежей базе, и в уже заполненной. */
export async function ensureBot(db: Db) {
  await db.insert(schema.users).values({
    id: "bot_komekshi", handle: BOT_PROFILE.handle, name: BOT_PROFILE.name, bio: BOT_PROFILE.bio,
    hue: hueFromHandle(BOT_PROFILE.handle), createdAt: new Date(0).toISOString(),
  }).onConflictDoNothing();
}
