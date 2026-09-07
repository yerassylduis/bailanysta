import type { Namespace } from "../index";

/** Неймспейс «search». Ключи одинаковы во всех трёх языках; множественное число — key.one/few/many/other. */
const search: Namespace = {
  ru: {
    pageTitle: "Поиск", tipsTitle: "Подсказки",
    tipTagExample: "#дизайн", tipTagText: "— все посты с тегом (по префиксу: #диз найдёт и #дизайн).",
    tipTextExample: "степь", tipTextText: "— поиск по тексту постов, без учёта регистра.",
    tipUserExample: "@aisha", tipUserText: "— люди по нику или имени.",
    people: "Люди", postsWithTag: "Посты с тегом {q}", postsForQuery: "Посты по запросу «{q}»",
    emptyTitle: "Ничего не нашлось", emptyText: "Попробуйте другое слово или тег. Или напишите об этом первым.", placeholder: "Слова, #теги, @люди…",
  },
  kk: {
    pageTitle: "Іздеу", tipsTitle: "Кеңестер",
    tipTagExample: "#дизайн", tipTagText: "— осы тегі бар барлық жазбалар (префикс бойынша: #диз #дизайн-ды да табады).",
    tipTextExample: "дала", tipTextText: "— жазба мәтіні бойынша іздеу, регистрге қарамайды.",
    tipUserExample: "@aisha", tipUserText: "— ник немесе аты бойынша адамдар.",
    people: "Адамдар", postsWithTag: "{q} тегі бар жазбалар", postsForQuery: "«{q}» сұранысы бойынша жазбалар",
    emptyTitle: "Ештеңе табылмады", emptyText: "Басқа сөз немесе тег байқап көріңіз. Немесе бұл туралы бірінші болып жазыңыз.", placeholder: "Сөздер, #тегтер, @адамдар…",
  },
  en: {
    pageTitle: "Search", tipsTitle: "Tips",
    tipTagExample: "#design", tipTagText: "— all posts with the tag (by prefix: #des also finds #design).",
    tipTextExample: "steppe", tipTextText: "— search in post text, case-insensitive.",
    tipUserExample: "@aisha", tipUserText: "— people by handle or name.",
    people: "People", postsWithTag: "Posts tagged {q}", postsForQuery: "Posts for “{q}”",
    emptyTitle: "Nothing found", emptyText: "Try another word or tag. Or be the first to write about it.", placeholder: "Words, #tags, @people…",
  },
};
export default search;
