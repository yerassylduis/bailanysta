import type { Namespace } from "../index";

/** Каркас приложения: навигация, тема, язык, экран блокировки, 404, заголовок сайта. */
const nav: Namespace = {
  ru: {
    feed: "Лента", explore: "Созвездие", messages: "Сообщения", calls: "Байланыс", notifications: "Уведомления", bookmarks: "Закладки", profile: "Профиль",
    login: "Войти", admin: "Админ", settings: "Настройки", search: "Поиск", compose: "Написать", loginByEmail: "Войти по почте",
    theme: "Тема", "theme.light": "День", "theme.dark": "Ночь", themeToggle: "Переключить тему", lang: "Язык",
    soundOn: "Звук уведомлений включён", soundOff: "Звук уведомлений выключен", soundEnable: "Включить звук уведомлений", soundDisable: "Выключить звук уведомлений",
    bannedTitle: "Аккаунт заблокирован", bannedUntil: "До {date}", bannedForever: "Без срока", bannedReason: "причина: {reason}",
    bannedHint: "Если вы считаете, что это ошибка, напишите администратору на почту сети.", logout: "Выйти из аккаунта",
    notFoundTitle: "Здесь ничего нет", notFoundText: "Страница потерялась где-то в степи.", toHome: "На главную",
    siteTitle: "Expert Bailanysta — байланыс между людьми", siteDescription: "Expert Bailanysta — небольшая уютная социальная сеть: посты, лента, созвездие связей и ИИ-соавтор Cosmos.",
  },
  kk: {
    feed: "Лента", explore: "Шоқжұлдыз", messages: "Хабарламалар", calls: "Байланыс", notifications: "Хабарландырулар", bookmarks: "Бетбелгілер", profile: "Профиль",
    login: "Кіру", admin: "Әкімші", settings: "Баптаулар", search: "Іздеу", compose: "Жазу", loginByEmail: "Пошта арқылы кіру",
    theme: "Тақырып", "theme.light": "Күн", "theme.dark": "Түн", themeToggle: "Тақырыпты ауыстыру", lang: "Тіл",
    soundOn: "Хабарландыру дыбысы қосулы", soundOff: "Хабарландыру дыбысы өшірулі", soundEnable: "Хабарландыру дыбысын қосу", soundDisable: "Хабарландыру дыбысын өшіру",
    bannedTitle: "Аккаунт бұғатталған", bannedUntil: "{date} дейін", bannedForever: "Мерзімсіз", bannedReason: "себебі: {reason}",
    bannedHint: "Бұл қате деп ойласаңыз, желі әкімшісіне поштаға жазыңыз.", logout: "Аккаунттан шығу",
    notFoundTitle: "Мұнда ештеңе жоқ", notFoundText: "Бет даланың бір жерінде жоғалып кетті.", toHome: "Басты бетке",
    siteTitle: "Expert Bailanysta — адамдар арасындағы байланыс", siteDescription: "Expert Bailanysta — кішкентай жайлы әлеуметтік желі: жазбалар, лента, байланыс шоқжұлдызы және Cosmos ИИ-серіктесі.",
  },
  en: {
    feed: "Feed", explore: "Constellation", messages: "Messages", calls: "Bailanys", notifications: "Notifications", bookmarks: "Bookmarks", profile: "Profile",
    login: "Sign in", admin: "Admin", settings: "Settings", search: "Search", compose: "Write", loginByEmail: "Sign in with email",
    theme: "Theme", "theme.light": "Day", "theme.dark": "Night", themeToggle: "Toggle theme", lang: "Language",
    soundOn: "Notification sound is on", soundOff: "Notification sound is off", soundEnable: "Turn notification sound on", soundDisable: "Turn notification sound off",
    bannedTitle: "Account suspended", bannedUntil: "Until {date}", bannedForever: "Indefinitely", bannedReason: "reason: {reason}",
    bannedHint: "If you believe this is a mistake, email the network administrator.", logout: "Sign out",
    notFoundTitle: "Nothing here", notFoundText: "The page got lost somewhere in the steppe.", toHome: "Go home",
    siteTitle: "Expert Bailanysta — connection between people", siteDescription: "Expert Bailanysta is a small, cosy social network: posts, feed, a constellation of connections and the Cosmos AI co-author.",
  },
};
export default nav;
