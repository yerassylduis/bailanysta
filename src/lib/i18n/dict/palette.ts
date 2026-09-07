import type { Namespace } from "../index";

/** Неймспейс «palette» — командная палитра ⌘K. Ключи одинаковы во всех трёх языках; множественное число — key.one/few/many/other. */
const palette: Namespace = {
  ru: {
    explore: "Созвездие связей", compose: "Написать пост", calls: "Байланыс · созвоны", me: "Мой профиль", admin: "Админ-панель",
    themeLight: "Светлая тема · {name}", themeDark: "Тёмная тема · {name}",
    searchFor: "Искать «{q}»", allPosts: "все посты", tag: "Тег {q}",
    aria: "Командная палитра", placeholder: "Куда идём? Люди, #теги, посты…", nothing: "Ничего не нашлось",
  },
  kk: {
    explore: "Байланыстар шоқжұлдызы", compose: "Жазба жазу", calls: "Байланыс · қоңыраулар", me: "Менің профилім", admin: "Әкімші панелі",
    themeLight: "Жарық тақырып · {name}", themeDark: "Қараңғы тақырып · {name}",
    searchFor: "«{q}» іздеу", allPosts: "барлық жазбалар", tag: "{q} тегі",
    aria: "Командалар палитрасы", placeholder: "Қайда барамыз? Адамдар, #тегтер, жазбалар…", nothing: "Ештеңе табылмады",
  },
  en: {
    explore: "Constellation of connections", compose: "Write a post", calls: "Bailanys · calls", me: "My profile", admin: "Admin panel",
    themeLight: "Light theme · {name}", themeDark: "Dark theme · {name}",
    searchFor: "Search “{q}”", allPosts: "all posts", tag: "Tag {q}",
    aria: "Command palette", placeholder: "Where to? People, #tags, posts…", nothing: "Nothing found",
  },
};
export default palette;
